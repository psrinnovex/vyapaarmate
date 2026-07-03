import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import nextEnv from "@next/env";
import prismaPkg from "@prisma/client";
import { SignJWT } from "jose";

const { loadEnvConfig } = nextEnv;
const { PrismaClient } = prismaPkg;

loadEnvConfig(process.cwd());

const baseUrl = normalizeBaseUrl(process.env.RESPONSIVE_BASE_URL ?? "http://localhost:3000");
const baseUrlWithPath = `${baseUrl}/`;
const chromePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = pickChromeDebugPort(process.env.CHROME_DEBUG_PORT);
const sessionCookieName = "vyapaarmate_session";
const routeFilter = new Set(
  (process.env.RESPONSIVE_ROUTES ?? "")
    .split(",")
    .map((route) => route.trim())
    .filter(Boolean)
);
const verbose = process.env.RESPONSIVE_VERBOSE === "1";

function normalizeBaseUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`RESPONSIVE_BASE_URL must be a valid http(s) URL. Received: ${value}`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`RESPONSIVE_BASE_URL must use http or https. Received: ${value}`);
  }

  return parsed.origin;
}

function pickChromeDebugPort(value) {
  const parsed = value ? Number(value) : 9333 + Math.floor(Math.random() * 500);
  if (!Number.isInteger(parsed) || parsed < 1024 || parsed > 65535) {
    throw new Error(`CHROME_DEBUG_PORT must be a whole number from 1024 to 65535. Received: ${value}`);
  }
  return parsed;
}

const viewports = [
  { name: "small-mobile-320", width: 320, height: 700, mobile: true, dpr: 3 },
  { name: "iphone-375", width: 375, height: 812, mobile: true, dpr: 3 },
  { name: "modern-phone-390", width: 390, height: 844, mobile: true, dpr: 3 },
  { name: "large-phone", width: 430, height: 932, mobile: true, dpr: 3 },
  { name: "tablet", width: 768, height: 1024, mobile: true, dpr: 2 },
  { name: "small-desktop", width: 1024, height: 768, mobile: false, dpr: 1 },
  { name: "desktop-1280", width: 1280, height: 832, mobile: false, dpr: 1 },
  { name: "desktop", width: 1440, height: 900, mobile: false, dpr: 1 }
];

const routes = [
  { group: "public", path: "/" },
  { group: "public", path: "/features" },
  { group: "public", path: "/pricing" },
  { group: "public", path: "/businesses" },
  { group: "public", path: "/contact" },
  { group: "public", path: "/login" },
  { group: "public", path: "/register" },
  { group: "public", path: "/b/sri-sai-tiffins" },
  { group: "owner", path: "/dashboard" },
  { group: "owner", path: "/dashboard/ai-suggestions" },
  { group: "owner", path: "/dashboard/orders" },
  { group: "owner", path: "/dashboard/menu" },
  { group: "owner", path: "/dashboard/payments" },
  { group: "owner", path: "/dashboard/settings" },
  { group: "owner", path: "/dashboard/billing" },
  { group: "admin", path: "/admin" },
  { group: "admin", path: "/admin/businesses" },
  { group: "admin", path: "/admin/payments" },
  { group: "admin", path: "/admin/subscriptions" },
  { group: "admin", path: "/admin/support" },
  { group: "admin", path: "/admin/logs" },
  { group: "admin", path: "/admin/settings" },
  { group: "support", path: "/support" }
];

const auditRoutes = routeFilter.size > 0 ? routes.filter((route) => routeFilter.has(route.path)) : routes;
const responsiveAuthEnvOrder = [
  "RESPONSIVE_OWNER_USER_ID",
  "RESPONSIVE_OWNER_BUSINESS_ID",
  "RESPONSIVE_ADMIN_USER_ID",
  "RESPONSIVE_SUPPORT_USER_ID",
  "JWT_SECRET"
];
const responsiveAuthEnvByGroup = {
  owner: ["RESPONSIVE_OWNER_USER_ID", "RESPONSIVE_OWNER_BUSINESS_ID", "JWT_SECRET"],
  admin: ["RESPONSIVE_ADMIN_USER_ID", "JWT_SECRET"],
  support: ["RESPONSIVE_SUPPORT_USER_ID", "JWT_SECRET"]
};
const routeRoleLabel = {
  public: "public",
  owner: "OWNER",
  admin: "SUPER_ADMIN",
  support: "SUPPORT_AGENT"
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function assertLocalAppReachable() {
  const healthUrl = `${baseUrl}/login`;
  let response;
  try {
    response = await fetch(healthUrl);
  } catch {
    throw new Error(`Local app is not reachable at ${healthUrl}. Start it with npm run dev or set RESPONSIVE_BASE_URL.`);
  }

  if (!response.ok) {
    const statusText = response.statusText ? ` ${response.statusText}` : "";
    throw new Error(`Local app responded at ${healthUrl} with HTTP ${response.status}${statusText}.`);
  }
}

function looksLikePlaceholderValue(value) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.startsWith("your-") ||
    normalized.startsWith("your_") ||
    normalized.startsWith("replace-") ||
    normalized.startsWith("replace_") ||
    normalized.includes("placeholder") ||
    normalized === "todo" ||
    normalized === "changeme" ||
    normalized === "change-me" ||
    normalized === "example" ||
    normalized === "undefined" ||
    normalized === "null" ||
    normalized === "00000000-0000-0000-0000-000000000000"
  );
}

function validateResponsiveAuthEnv(routeGroups) {
  const required = new Set();
  for (const group of routeGroups) {
    for (const envName of responsiveAuthEnvByGroup[group] ?? []) {
      required.add(envName);
    }
  }

  if (required.size === 0) return;

  const missing = responsiveAuthEnvOrder.filter((envName) => required.has(envName) && !process.env[envName]?.trim());
  const placeholders = responsiveAuthEnvOrder.filter((envName) => {
    const value = process.env[envName];
    return required.has(envName) && value && looksLikePlaceholderValue(value);
  });
  const hasShortJwtSecret = required.has("JWT_SECRET") &&
    process.env.JWT_SECRET &&
    !looksLikePlaceholderValue(process.env.JWT_SECRET) &&
    process.env.JWT_SECRET.length < 24;
  const shortSecrets = hasShortJwtSecret ? ["JWT_SECRET"] : [];

  if (missing.length === 0 && placeholders.length === 0 && shortSecrets.length === 0) return;

  const lines = ["Authenticated responsive audit routes require local audit user env vars."];
  if (missing.length > 0) {
    lines.push("Missing env vars:", ...missing.map((envName) => `- ${envName}`));
  }
  if (placeholders.length > 0) {
    lines.push("Invalid placeholder env values:", ...placeholders.map((envName) => `- ${envName}`));
  }
  if (shortSecrets.length > 0) {
    lines.push("Invalid env values:", ...shortSecrets.map((envName) => `- ${envName} must be at least 24 characters`));
  }
  lines.push("Set these in .env.local with real local user IDs/business IDs and the same JWT_SECRET used by the app.");
  throw new Error(lines.join("\n"));
}

async function validateResponsiveAuditRecords(routeGroups) {
  if (!["owner", "admin", "support"].some((group) => routeGroups.has(group))) return;

  const prisma = new PrismaClient();
  const errors = [];

  try {
    if (routeGroups.has("owner")) {
      const [owner, business] = await Promise.all([
        prisma.user.findUnique({
          where: { id: process.env.RESPONSIVE_OWNER_USER_ID },
          select: { role: true, businessId: true }
        }),
        prisma.business.findUnique({
          where: { id: process.env.RESPONSIVE_OWNER_BUSINESS_ID },
          select: { id: true, isActive: true, isVerified: true }
        })
      ]);

      if (!owner) {
        errors.push("RESPONSIVE_OWNER_USER_ID does not match a user in the configured DATABASE_URL.");
      } else {
        if (owner.role !== "OWNER") errors.push(`RESPONSIVE_OWNER_USER_ID must point to an OWNER user, found ${owner.role}.`);
        if (owner.businessId !== process.env.RESPONSIVE_OWNER_BUSINESS_ID) {
          errors.push("RESPONSIVE_OWNER_USER_ID must belong to RESPONSIVE_OWNER_BUSINESS_ID.");
        }
      }
      if (!business) {
        errors.push("RESPONSIVE_OWNER_BUSINESS_ID does not match a business in the configured DATABASE_URL.");
      } else {
        if (!business.isActive) errors.push("RESPONSIVE_OWNER_BUSINESS_ID points to an inactive business.");
        if (!business.isVerified) errors.push("RESPONSIVE_OWNER_BUSINESS_ID points to an unverified business.");
      }
    }

    if (routeGroups.has("admin")) {
      const admin = await prisma.user.findUnique({
        where: { id: process.env.RESPONSIVE_ADMIN_USER_ID },
        select: { role: true }
      });
      if (!admin) {
        errors.push("RESPONSIVE_ADMIN_USER_ID does not match a user in the configured DATABASE_URL.");
      } else if (admin.role !== "SUPER_ADMIN") {
        errors.push(`RESPONSIVE_ADMIN_USER_ID must point to a SUPER_ADMIN user, found ${admin.role}.`);
      }
    }

    if (routeGroups.has("support")) {
      const support = await prisma.user.findUnique({
        where: { id: process.env.RESPONSIVE_SUPPORT_USER_ID },
        select: { role: true }
      });
      if (!support) {
        errors.push("RESPONSIVE_SUPPORT_USER_ID does not match a user in the configured DATABASE_URL.");
      } else if (support.role !== "SUPPORT_AGENT") {
        errors.push(`RESPONSIVE_SUPPORT_USER_ID must point to a SUPPORT_AGENT user, found ${support.role}.`);
      }
    }
  } catch (error) {
    errors.push(`Could not verify responsive audit users against DATABASE_URL: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await prisma.$disconnect();
  }

  if (errors.length === 0) return;

  throw new Error([
    "Responsive audit auth database preflight failed.",
    "The app revalidates signed session cookies against the database, so the audit IDs must exist in the same DATABASE_URL used by npm run dev.",
    ...errors.map((error) => `- ${error}`),
    "Run node scripts/seed-responsive-audit-users.mjs against the same local database, then export the printed RESPONSIVE_* values.",
    "For setup details, see docs/local-responsive-qa.md."
  ].join("\n"));
}

async function waitForJson(url, timeoutMs = 15000) {
  const start = Date.now();
  let lastError;
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error("JWT_SECRET must be set to create a responsive audit session cookie.");
  }
  return new TextEncoder().encode(secret);
}

async function createSessionCookie(user) {
  const token = await new SignJWT({
    name: user.name,
    email: user.email,
    role: user.role,
    businessId: user.businessId ?? null
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(jwtSecret());

  return { name: sessionCookieName, value: token };
}

async function adminCookieForAudit() {
  return createSessionCookie({
    id: process.env.RESPONSIVE_ADMIN_USER_ID,
    name: process.env.RESPONSIVE_ADMIN_USER_NAME ?? "Audit Admin",
    email: process.env.RESPONSIVE_ADMIN_USER_EMAIL ?? "audit.admin@example.test",
    role: "SUPER_ADMIN",
    businessId: null
  });
}

async function ownerCookieForAudit() {
  return createSessionCookie({
    id: process.env.RESPONSIVE_OWNER_USER_ID,
    name: process.env.RESPONSIVE_OWNER_USER_NAME ?? "Audit Owner",
    email: process.env.RESPONSIVE_OWNER_USER_EMAIL ?? "audit.owner@example.test",
    role: process.env.RESPONSIVE_OWNER_USER_ROLE ?? "OWNER",
    businessId: process.env.RESPONSIVE_OWNER_BUSINESS_ID
  });
}

async function supportCookieForAudit() {
  return createSessionCookie({
    id: process.env.RESPONSIVE_SUPPORT_USER_ID,
    name: process.env.RESPONSIVE_SUPPORT_USER_NAME ?? "Audit Support",
    email: process.env.RESPONSIVE_SUPPORT_USER_EMAIL ?? "audit.support@example.test",
    role: "SUPPORT_AGENT",
    businessId: null
  });
}

class CdpSession {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
    this.ws.addEventListener("message", (event) => this.handleMessage(event));
  }

  handleMessage(event) {
    const message = JSON.parse(event.data);
    if (message.id && this.pending.has(message.id)) {
      const { resolve, reject, timeout } = this.pending.get(message.id);
      this.pending.delete(message.id);
      clearTimeout(timeout);
      if (message.error) reject(new Error(`${message.error.message ?? "CDP error"} ${JSON.stringify(message.error.data ?? "")}`));
      else resolve(message.result ?? {});
      return;
    }
    if (message.method && this.listeners.has(message.method)) {
      for (const listener of this.listeners.get(message.method)) listener(message.params ?? {});
    }
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for ${method}`));
      }, 30000);
      this.pending.set(id, { resolve, reject, timeout });
    });
  }

  once(method, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        remove();
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
      const listener = (params) => {
        clearTimeout(timeout);
        remove();
        resolve(params);
      };
      const remove = () => {
        const listeners = this.listeners.get(method);
        if (!listeners) return;
        listeners.delete(listener);
      };
      if (!this.listeners.has(method)) this.listeners.set(method, new Set());
      this.listeners.get(method).add(listener);
    });
  }

  on(method, listener) {
    if (!this.listeners.has(method)) this.listeners.set(method, new Set());
    this.listeners.get(method).add(listener);
  }

  off(method, listener) {
    const listeners = this.listeners.get(method);
    if (!listeners) return;
    listeners.delete(listener);
    if (listeners.size === 0) this.listeners.delete(method);
  }

  close(timeoutMs = 1000) {
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) return Promise.resolve();
    return new Promise((resolve) => {
      const timeout = setTimeout(resolve, timeoutMs);
      this.ws.addEventListener("close", () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
      try {
        this.ws.close();
      } catch {
        clearTimeout(timeout);
        resolve();
      }
    });
  }
}

function pageAuditExpression() {
  return `(() => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const doc = document.documentElement;
    const body = document.body;
    const maxScrollWidth = Math.max(doc.scrollWidth, body ? body.scrollWidth : 0);
    const horizontalOverflow = Math.max(0, maxScrollWidth - viewportWidth);
    const visible = (el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const shortSelector = (el) => {
      const tag = el.tagName.toLowerCase();
      const id = el.id ? "#" + el.id : "";
      const cls = String(el.className || "").split(/\\s+/).filter(Boolean).slice(0, 3).map((part) => "." + part).join("");
      return (tag + id + cls).slice(0, 140);
    };
    const textOf = (el) => (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 120);
    const fieldValue = (el) => "value" in el ? String(el.value || "").replace(/\\s+/g, " ").trim().slice(0, 120) : "";
    const all = Array.from(document.body.querySelectorAll("*"));
    const wideElements = all
      .filter(visible)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          selector: shortSelector(el),
          text: textOf(el),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          overflowX: getComputedStyle(el).overflowX
        };
      })
      .filter((item) => item.right > viewportWidth + 2 || item.left < -2 || item.width > viewportWidth + 2)
      .slice(0, 12);
    const hugeTextLimit = viewportWidth <= 430 ? 52 : viewportWidth <= 768 ? 64 : 96;
    const hugeText = all
      .filter((el) => visible(el) && textOf(el).length > 1 && !["svg", "path"].includes(el.tagName.toLowerCase()))
      .map((el) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          selector: shortSelector(el),
          text: textOf(el),
          fontSize: Math.round(parseFloat(style.fontSize)),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      })
      .filter((item) => item.fontSize > hugeTextLimit)
      .slice(0, 10);
    const clippedControls = Array.from(document.querySelectorAll("button, a, input, textarea, select, [role='button']"))
      .filter(visible)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          selector: shortSelector(el),
          name: el.getAttribute("name") || "",
          type: el.getAttribute("type") || "",
          text: textOf(el) || fieldValue(el) || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "",
          placeholder: el.getAttribute("placeholder") || "",
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      })
      .filter((item) => item.scrollWidth > item.clientWidth + 2)
      .slice(0, 10);
    const tinyTapTargets = Array.from(document.querySelectorAll("button, a, input, select, textarea, [role='button']"))
      .filter(visible)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          selector: shortSelector(el),
          text: textOf(el) || el.getAttribute("aria-label") || "",
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      })
      .filter((item) => item.width < 34 || item.height < 34)
      .slice(0, 10);
    const tallestVisible = all
      .filter(visible)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          selector: shortSelector(el),
          text: textOf(el),
          height: Math.round(rect.height),
          width: Math.round(rect.width)
        };
      })
      .filter((item) => item.height > viewportHeight * 1.35 && item.selector !== "body" && item.selector !== "main")
      .slice(0, 8);
    return {
      url: location.href,
      title: document.title,
      viewportWidth,
      viewportHeight,
      horizontalOverflow,
      documentHeight: Math.round(doc.scrollHeight),
      wideElements,
      hugeText,
      clippedControls,
      tinyTapTargets,
      tallestVisible
    };
  })()`;
}

async function createTarget(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
  if (!response.ok) throw new Error(`Could not create Chrome target: ${response.status}`);
  return response.json();
}

async function setSessionCookie(cdp, cookie, route) {
  await cdp.send("Network.clearBrowserCookies");
  if (!cookie) {
    return {
      required: false,
      stored: false,
      reason: "route does not require an audit session cookie"
    };
  }

  const base = new URL(baseUrl);
  const cookieParams = {
    name: cookie.name,
    value: cookie.value,
    url: baseUrlWithPath,
    path: "/",
    httpOnly: true,
    secure: base.protocol === "https:",
    sameSite: "Lax",
    expires: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7)
  };

  const result = await cdp.send("Network.setCookie", cookieParams);
  if (result.success === false) {
    throw new Error(`Chrome refused to set ${cookie.name} for ${baseUrl}.`);
  }

  const storedCookies = await cdp.send("Network.getCookies", { urls: [baseUrlWithPath] });
  const storedCookie = (storedCookies.cookies ?? []).find((candidate) => candidate.name === cookie.name);
  if (!storedCookie || storedCookie.value !== cookie.value) {
    throw new Error(
      [
        `Chrome did not store the audit session cookie for ${route.path}.`,
        `Expected cookie: ${cookie.name} at ${baseUrlWithPath}.`,
        "Check that RESPONSIVE_BASE_URL matches the app origin and that Chrome is allowed to store localhost cookies."
      ].join("\n")
    );
  }

  return {
    required: true,
    stored: true,
    domain: storedCookie.domain,
    path: storedCookie.path,
    secure: storedCookie.secure,
    httpOnly: storedCookie.httpOnly,
    sameSite: storedCookie.sameSite ?? "unspecified"
  };
}

function waitForExit(child, timeoutMs = 1500) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(timeoutMs)
  ]);
}

async function removeProfileDir(profileDir) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await rm(profileDir, { recursive: true, force: true, maxRetries: 2, retryDelay: 120 });
      return;
    } catch (error) {
      if (attempt === 3) throw error;
      await delay(250);
    }
  }
}

function shouldIgnoreResourceFailure(errorText, url = "") {
  return (
    url.endsWith("/favicon.ico") ||
    url.endsWith("/_vercel/speed-insights/script.js") ||
    url.includes("vercel-scripts.com/v1/speed-insights/") ||
    errorText === "net::ERR_ABORTED"
  );
}

function shouldIgnoreConsoleError(text) {
  return text.includes("/_vercel/speed-insights/script.js") ||
    text.includes("vercel-scripts.com/v1/speed-insights/");
}

function normalizePathname(value) {
  return value.length > 1 ? value.replace(/\/+$/, "") : value;
}

async function navigateAndAudit(cdp, route, viewport, cookies) {
  const consoleErrors = [];
  const runtimeErrors = [];
  const resourceErrors = [];
  const requestUrls = new Map();
  const documentRequestIds = new Set();
  const pendingExtraInfoByRequestId = new Map();
  const documentResponses = [];
  const documentCookieHeaders = [];
  const listeners = [];
  const addListener = (method, listener) => {
    listeners.push([method, listener]);
    cdp.on(method, listener);
  };
  const recordDocumentCookieHeader = (params) => {
    const headers = params.headers ?? {};
    const cookieHeader = headers.Cookie ?? headers.cookie ?? "";
    documentCookieHeaders.push({
      hasSessionCookie: typeof cookieHeader === "string" && cookieHeader.includes(`${sessionCookieName}=`),
      blockedCookies: (params.associatedCookies ?? [])
        .filter((cookie) => Array.isArray(cookie.blockedReasons) && cookie.blockedReasons.length > 0)
        .map((cookie) => ({
          name: cookie.cookie?.name ?? "unknown",
          blockedReasons: cookie.blockedReasons
        }))
    });
  };

  addListener("Runtime.exceptionThrown", (params) => {
    runtimeErrors.push(
      params.exceptionDetails?.exception?.description ??
      params.exceptionDetails?.text ??
      "Runtime exception"
    );
  });
  addListener("Log.entryAdded", (params) => {
    const text = params.entry?.text ?? "";
    if (params.entry?.level === "error" && !text.startsWith("Failed to load resource") && !shouldIgnoreConsoleError(text)) {
      consoleErrors.push(text);
    }
  });
  addListener("Network.requestWillBeSent", (params) => {
    const url = params.request?.url ?? "";
    requestUrls.set(params.requestId, url);
    if (params.redirectResponse && (params.type === "Document" || documentRequestIds.has(params.requestId))) {
      documentResponses.push({
        status: params.redirectResponse.status ?? 0,
        url: params.redirectResponse.url ?? url
      });
    }
    if (params.type === "Document") {
      documentRequestIds.add(params.requestId);
      const pendingExtraInfo = pendingExtraInfoByRequestId.get(params.requestId);
      if (pendingExtraInfo) {
        recordDocumentCookieHeader(pendingExtraInfo);
        pendingExtraInfoByRequestId.delete(params.requestId);
      }
    }
  });
  addListener("Network.requestWillBeSentExtraInfo", (params) => {
    if (documentRequestIds.has(params.requestId)) {
      recordDocumentCookieHeader(params);
      return;
    }
    pendingExtraInfoByRequestId.set(params.requestId, params);
  });
  addListener("Network.responseReceived", (params) => {
    const status = params.response?.status ?? 0;
    const url = params.response?.url ?? "";
    if (params.type === "Document" || documentRequestIds.has(params.requestId)) {
      documentResponses.push({ status, url });
    }
    if (status >= 400 && !shouldIgnoreResourceFailure("", url)) resourceErrors.push(`${status} ${url}`);
  });
  addListener("Network.loadingFailed", (params) => {
    const url = requestUrls.get(params.requestId) ?? params.requestId;
    if (params.errorText && !shouldIgnoreResourceFailure(params.errorText, url)) {
      resourceErrors.push(`${params.errorText} ${url}`);
    }
  });

  try {
    const blankLoaded = cdp.once("Page.loadEventFired", 5000).catch(() => null);
    await cdp.send("Page.navigate", { url: "about:blank" });
    await blankLoaded;
    await delay(100);
    const cookieDiagnostic = await setSessionCookie(cdp, cookies[route.group] ?? null, route);
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: viewport.dpr,
      mobile: viewport.mobile
    });

    requestUrls.clear();
    documentRequestIds.clear();
    documentResponses.length = 0;
    resourceErrors.length = 0;

    const loaded = cdp.once("Page.loadEventFired", 45000).catch(() => null);
    const navigation = await cdp.send("Page.navigate", { url: `${baseUrl}${route.path}` });
    if (navigation.errorText) {
      resourceErrors.push(`${navigation.errorText} ${baseUrl}${route.path}`);
    }
    await loaded;
    await delay(900);
    const result = await cdp.send("Runtime.evaluate", {
      expression: pageAuditExpression(),
      returnByValue: true,
      awaitPromise: true
    });
    if (result.exceptionDetails) {
      const detail = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "unknown page audit exception";
      throw new Error(`Page audit failed for ${route.path} at ${viewport.name}: ${detail}`);
    }
    const metrics = result.result?.value;
    if (!metrics) {
      const description = result.result?.description ? ` ${result.result.description}` : "";
      throw new Error(`Page audit returned no metrics for ${route.path} at ${viewport.name}.${description}`);
    }

    const finalDocumentResponse = documentResponses.at(-1) ?? null;
    return {
      route,
      viewport,
      status: finalDocumentResponse?.status ?? null,
      metrics,
      cookieDiagnostic,
      documentCookieHeaders: documentCookieHeaders.slice(0, 5),
      consoleErrors: consoleErrors.slice(0, 5),
      runtimeErrors: runtimeErrors.slice(0, 5),
      resourceErrors: resourceErrors.slice(0, 5)
    };
  } finally {
    for (const [method, listener] of listeners) cdp.off(method, listener);
  }
}

function documentSentSessionCookie(result) {
  return result.documentCookieHeaders?.some((entry) => entry.hasSessionCookie) ?? false;
}

function analyzeResult(result) {
  const label = `${result.route.path} @ ${result.viewport.name}`;
  const metrics = result.metrics;
  const hardFailures = [];
  const warnings = [];
  const auditedPath = normalizePathname(new URL(metrics.url).pathname);
  const expectedPath = normalizePathname(result.route.path);

  if (auditedPath !== expectedPath) {
    const cookieDetails = result.cookieDiagnostic?.required
      ? [
          `audit cookie stored=${Boolean(result.cookieDiagnostic.stored)}`,
          `domain=${result.cookieDiagnostic.domain ?? "unknown"}`,
          `path=${result.cookieDiagnostic.path ?? "unknown"}`,
          `secure=${Boolean(result.cookieDiagnostic.secure)}`,
          `httpOnly=${Boolean(result.cookieDiagnostic.httpOnly)}`,
          `document sent session cookie=${documentSentSessionCookie(result) ? "yes" : "no"}`
        ]
      : ["route does not require an audit session cookie"];
    hardFailures.push({
      label,
      reason: `ended at ${metrics.url} instead of ${result.route.path}`,
      details: ["Auth/RBAC or route handling redirected the audit target.", ...cookieDetails]
    });
  }
  if (typeof result.status === "number" && result.status >= 400) {
    hardFailures.push({
      label,
      reason: `document returned HTTP ${result.status}`,
      details: [metrics.url]
    });
  }
  if (metrics.horizontalOverflow > 2) {
    hardFailures.push({ label, reason: `body overflows horizontally by ${metrics.horizontalOverflow}px`, details: metrics.wideElements });
  }
  if (metrics.clippedControls.length > 0) {
    hardFailures.push({ label, reason: "interactive control text/content is clipped", details: metrics.clippedControls });
  }
  if (metrics.hugeText.length > 0) {
    warnings.push({ label, reason: "very large text detected", details: metrics.hugeText });
  }
  if (metrics.tallestVisible.length > 0 && result.viewport.width <= 430) {
    warnings.push({ label, reason: "single visible block is taller than expected on phone", details: metrics.tallestVisible });
  }
  if (result.consoleErrors.length || result.runtimeErrors.length || result.resourceErrors.length) {
    hardFailures.push({ label, reason: "browser console/runtime/resource errors", details: [...result.consoleErrors, ...result.runtimeErrors, ...result.resourceErrors] });
  }

  return { hardFailures, warnings };
}

function formatRouteResult(result) {
  const analysis = analyzeResult(result);
  const reasons = analysis.hardFailures.map((failure) => failure.reason);
  const warningReasons = analysis.warnings.map((warning) => warning.reason);
  const outcome = reasons.length > 0 ? "FAIL" : "PASS";
  const reason = reasons.length > 0 ? reasons.join("; ") : warningReasons.length > 0 ? `warnings: ${warningReasons.join("; ")}` : "responsive checks passed";

  return [
    outcome,
    `route=${result.route.path}`,
    `role=${routeRoleLabel[result.route.group] ?? result.route.group}`,
    `viewport=${result.viewport.name}`,
    `finalUrl=${result.metrics.url}`,
    `status=${result.status ?? "unknown"}`,
    `cookieStored=${result.cookieDiagnostic?.required ? Boolean(result.cookieDiagnostic.stored) : "not-required"}`,
    `cookieSent=${result.cookieDiagnostic?.required ? documentSentSessionCookie(result) : "not-required"}`,
    `reason=${reason}`
  ].join(" | ");
}

function summarize(results) {
  const hardFailures = [];
  const warnings = [];
  for (const result of results) {
    const analysis = analyzeResult(result);
    hardFailures.push(...analysis.hardFailures);
    warnings.push(...analysis.warnings);
  }
  return { hardFailures, warnings };
}

async function main() {
  if (auditRoutes.length === 0) {
    throw new Error(`No audit routes matched RESPONSIVE_ROUTES=${Array.from(routeFilter).join(",")}`);
  }

  await assertLocalAppReachable();

  const routeGroups = new Set(auditRoutes.map((route) => route.group));
  validateResponsiveAuthEnv(routeGroups);
  await validateResponsiveAuditRecords(routeGroups);

  const profileDir = await mkdtemp(path.join(tmpdir(), "bhojzo-responsive-chrome-"));
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-address=127.0.0.1`,
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    "about:blank"
  ], { stdio: ["ignore", "ignore", "pipe"] });

  let chromeError = "";
  chrome.stderr.on("data", (chunk) => {
    chromeError += chunk.toString();
  });

  let cdp;
  try {
    await waitForJson(`http://127.0.0.1:${port}/json/version`);
    const [ownerCookie, adminCookie, supportCookie] = await Promise.all([
      routeGroups.has("owner") ? ownerCookieForAudit() : null,
      routeGroups.has("admin") ? adminCookieForAudit() : null,
      routeGroups.has("support") ? supportCookieForAudit() : null
    ]);
    const target = await createTarget(port);
    cdp = new CdpSession(target.webSocketDebuggerUrl);
    await cdp.connect();
    await Promise.all([
      cdp.send("Page.enable"),
      cdp.send("Runtime.enable"),
      cdp.send("Log.enable"),
      cdp.send("Network.enable")
    ]);
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });

    const results = [];
    for (const route of auditRoutes) {
      for (const viewport of viewports) {
        console.log(`Checking route=${route.path} role=${routeRoleLabel[route.group] ?? route.group} viewport=${viewport.name}`);
        const result = await navigateAndAudit(cdp, route, viewport, { owner: ownerCookie, admin: adminCookie, support: supportCookie });
        results.push(result);
        console.log(formatRouteResult(result));
        if (verbose && result.metrics.clippedControls.length > 0) {
          console.log(JSON.stringify(result.metrics.clippedControls, null, 2));
        }
      }
    }
    const summary = summarize(results);
    console.log(JSON.stringify(summary, null, 2));
    if (summary.hardFailures.length > 0) process.exitCode = 1;
  } finally {
    await cdp?.close();
    chrome.kill("SIGTERM");
    await waitForExit(chrome);
    await removeProfileDir(profileDir);
    if (process.exitCode && chromeError) {
      console.error(chromeError.split("\n").slice(0, 20).join("\n"));
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  if (verbose && error instanceof Error && error.stack) console.error(error.stack);
  process.exit(1);
});
