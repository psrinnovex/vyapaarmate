import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import nextEnv from "@next/env";
import { SignJWT } from "jose";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const baseUrl = process.env.RESPONSIVE_BASE_URL ?? "http://localhost:3001";
const chromePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = Number(process.env.CHROME_DEBUG_PORT ?? 9333);
const sessionCookieName = "vyapaarmate_session";
const routeFilter = new Set(
  (process.env.RESPONSIVE_ROUTES ?? "")
    .split(",")
    .map((route) => route.trim())
    .filter(Boolean)
);
const verbose = process.env.RESPONSIVE_VERBOSE === "1";

const viewports = [
  { name: "small-phone", width: 360, height: 740, mobile: true, dpr: 3 },
  { name: "phone", width: 390, height: 844, mobile: true, dpr: 3 },
  { name: "large-phone", width: 430, height: 932, mobile: true, dpr: 3 },
  { name: "tablet", width: 768, height: 1024, mobile: true, dpr: 2 },
  { name: "small-desktop", width: 1024, height: 768, mobile: false, dpr: 1 },
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
  { group: "admin", path: "/admin/settings" }
];

const auditRoutes = routeFilter.size > 0 ? routes.filter((route) => routeFilter.has(route.path)) : routes;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function getSetCookies(headers) {
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const cookie = headers.get("set-cookie");
  return cookie ? [cookie] : [];
}

async function login(email, password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!response.ok) throw new Error(`Login failed for ${email}: ${response.status}`);
  const cookie = getSetCookies(response.headers).find((value) => value.startsWith("vyapaarmate_session="));
  if (!cookie) throw new Error(`Session cookie was not returned for ${email}`);
  const [nameValue] = cookie.split(";");
  const [name, ...valueParts] = nameValue.split("=");
  return { name, value: valueParts.join("=") };
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
    .setExpirationTime("45m")
    .sign(jwtSecret());

  return { name: sessionCookieName, value: token };
}

async function adminCookieForAudit() {
  if (!process.env.RESPONSIVE_ADMIN_USER_ID) return login("admin@pshrinnovex.com", "ChangeMe123!");

  return createSessionCookie({
    id: process.env.RESPONSIVE_ADMIN_USER_ID,
    name: process.env.RESPONSIVE_ADMIN_USER_NAME ?? "PSHR Admin",
    email: process.env.RESPONSIVE_ADMIN_USER_EMAIL ?? "admin@pshrinnovex.com",
    role: "SUPER_ADMIN",
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
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
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
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for ${method}`));
      }, 30000);
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

  close() {
    this.ws?.close();
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

async function setSessionCookie(cdp, cookie) {
  await cdp.send("Network.clearBrowserCookies");
  if (!cookie) return;
  await cdp.send("Network.setCookie", {
    name: cookie.name,
    value: cookie.value,
    url: baseUrl,
    path: "/",
    httpOnly: true,
    sameSite: "Lax"
  });
}

function waitForExit(child, timeoutMs = 1500) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(timeoutMs)
  ]);
}

function shouldIgnoreResourceFailure(errorText, url = "") {
  return (
    url.endsWith("/favicon.ico") ||
    errorText === "net::ERR_ABORTED"
  );
}

async function navigateAndAudit(cdp, route, viewport, cookies) {
  const consoleErrors = [];
  const runtimeErrors = [];
  const resourceErrors = [];
  const requestUrls = new Map();
  cdp.on("Runtime.exceptionThrown", (params) => {
    runtimeErrors.push(
      params.exceptionDetails?.exception?.description ??
      params.exceptionDetails?.text ??
      "Runtime exception"
    );
  });
  cdp.on("Log.entryAdded", (params) => {
    const text = params.entry?.text ?? "";
    if (params.entry?.level === "error" && !text.startsWith("Failed to load resource")) {
      consoleErrors.push(text);
    }
  });
  cdp.on("Network.requestWillBeSent", (params) => {
    requestUrls.set(params.requestId, params.request?.url ?? "");
  });
  cdp.on("Network.responseReceived", (params) => {
    const status = params.response?.status ?? 0;
    const url = params.response?.url ?? "";
    if (status >= 400 && !shouldIgnoreResourceFailure("", url)) resourceErrors.push(`${status} ${url}`);
  });
  cdp.on("Network.loadingFailed", (params) => {
    const url = requestUrls.get(params.requestId) ?? params.requestId;
    if (params.errorText && !shouldIgnoreResourceFailure(params.errorText, url)) {
      resourceErrors.push(`${params.errorText} ${url}`);
    }
  });

  await setSessionCookie(cdp, cookies[route.group] ?? null);
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.dpr,
    mobile: viewport.mobile
  });
  const loaded = cdp.once("Page.loadEventFired", 45000).catch(() => null);
  await cdp.send("Page.navigate", { url: `${baseUrl}${route.path}` });
  await loaded;
  await delay(900);
  const result = await cdp.send("Runtime.evaluate", {
    expression: pageAuditExpression(),
    returnByValue: true,
    awaitPromise: true
  });
  return {
    route,
    viewport,
    metrics: result.result.value,
    consoleErrors: consoleErrors.slice(0, 5),
    runtimeErrors: runtimeErrors.slice(0, 5),
    resourceErrors: resourceErrors.slice(0, 5)
  };
}

function summarize(results) {
  const hardFailures = [];
  const warnings = [];
  for (const result of results) {
    const label = `${result.route.path} @ ${result.viewport.name}`;
    const metrics = result.metrics;
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
  }
  return { hardFailures, warnings };
}

async function main() {
  const health = await fetch(baseUrl);
  if (!health.ok) throw new Error(`${baseUrl} is not reachable: ${health.status}`);

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

  try {
    await waitForJson(`http://127.0.0.1:${port}/json/version`);
    const routeGroups = new Set(auditRoutes.map((route) => route.group));
    const [ownerCookie, adminCookie] = await Promise.all([
      routeGroups.has("owner") ? login("owner@demo.com", "ChangeMe123!") : null,
      routeGroups.has("admin") ? adminCookieForAudit() : null
    ]);
    const target = await createTarget(port);
    const cdp = new CdpSession(target.webSocketDebuggerUrl);
    await cdp.connect();
    await Promise.all([
      cdp.send("Page.enable"),
      cdp.send("Runtime.enable"),
      cdp.send("Log.enable"),
      cdp.send("Network.enable")
    ]);

    const results = [];
    if (auditRoutes.length === 0) {
      throw new Error(`No audit routes matched RESPONSIVE_ROUTES=${Array.from(routeFilter).join(",")}`);
    }

    for (const route of auditRoutes) {
      for (const viewport of viewports) {
        process.stdout.write(`Checking ${route.path} at ${viewport.name}... `);
        const result = await navigateAndAudit(cdp, route, viewport, { owner: ownerCookie, admin: adminCookie });
        results.push(result);
        const overflow = result.metrics.horizontalOverflow;
        const clipped = result.metrics.clippedControls.length;
        const huge = result.metrics.hugeText.length;
        console.log(`overflow=${overflow}px clipped=${clipped} huge=${huge}`);
        if (verbose && clipped > 0) {
          console.log(JSON.stringify(result.metrics.clippedControls, null, 2));
        }
      }
    }
    cdp.close();

    const summary = summarize(results);
    console.log(JSON.stringify(summary, null, 2));
    if (summary.hardFailures.length > 0) process.exitCode = 1;
  } finally {
    chrome.kill("SIGTERM");
    await waitForExit(chrome);
    await rm(profileDir, { recursive: true, force: true });
    if (process.exitCode && chromeError) {
      console.error(chromeError.split("\n").slice(0, 20).join("\n"));
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
