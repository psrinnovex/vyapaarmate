import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);
const SECRET_PLACEHOLDERS = ["replace", "placeholder", "changeme", "change-me", "example", "your-secret", "todo"];

function fail(message) {
  throw new Error(`[production-build] ${message}`);
}

function databaseUrl(name) {
  const value = process.env[name]?.trim();
  if (!value) fail(`${name} is required for a production deployment.`);

  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${name} must be a valid PostgreSQL URL.`);
  }

  if (!url || !["postgres:", "postgresql:"].includes(url.protocol)) {
    fail(`${name} must use the PostgreSQL protocol.`);
  }
  if (LOCAL_HOSTS.has(url.hostname)) {
    fail(`${name} must not target a local database in production.`);
  }
  if (url.searchParams.get("sslmode") !== "require") {
    fail(`${name} must include sslmode=require.`);
  }

  return url;
}

function supabaseProjectRef(url) {
  const username = decodeURIComponent(url.username);
  const poolerUsername = /^postgres\.([a-z0-9-]+)$/i.exec(username);
  if (poolerUsername) return poolerUsername[1].toLowerCase();

  const directHost = /^db\.([a-z0-9-]+)\.supabase\.co$/i.exec(url.hostname);
  return directHost?.[1]?.toLowerCase() ?? null;
}

function validateCronSecret() {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  if (secret.length < 32) fail("CRON_SECRET must be set and at least 32 characters in Production.");

  const normalized = secret.toLowerCase();
  if (SECRET_PLACEHOLDERS.some((placeholder) => normalized.includes(placeholder))) {
    fail("CRON_SECRET must not contain a placeholder value in Production.");
  }
}

function validateProductionDatabaseTarget() {
  const runtimeUrl = databaseUrl("DATABASE_URL");
  const directUrl = databaseUrl("DIRECT_URL");

  if (!runtimeUrl.hostname.endsWith(".pooler.supabase.com")) {
    fail("DATABASE_URL must use the Supabase transaction pooler.");
  }
  if (runtimeUrl.port !== "6543" || runtimeUrl.searchParams.get("pgbouncer") !== "true") {
    fail("DATABASE_URL must use port 6543 with pgbouncer=true.");
  }

  const directPooler = directUrl.hostname.endsWith(".pooler.supabase.com");
  const directDatabase = /^db\.[a-z0-9-]+\.supabase\.co$/i.test(directUrl.hostname);
  if (!directPooler && !directDatabase) {
    fail("DIRECT_URL must use a Supabase session pooler or direct database host.");
  }
  if (directPooler && directUrl.port !== "5432") {
    fail("A Supabase session-pooler DIRECT_URL must use port 5432.");
  }
  if (directDatabase && directUrl.port && directUrl.port !== "5432") {
    fail("A direct Supabase DIRECT_URL must use port 5432.");
  }
  if (directUrl.searchParams.get("pgbouncer") === "true") {
    fail("DIRECT_URL must not enable pgbouncer.");
  }

  const runtimeProject = supabaseProjectRef(runtimeUrl);
  const directProject = supabaseProjectRef(directUrl);
  if (!runtimeProject || !directProject || runtimeProject !== directProject) {
    fail("DATABASE_URL and DIRECT_URL must resolve to the same Supabase project.");
  }
  if (runtimeUrl.pathname !== directUrl.pathname) {
    fail("DATABASE_URL and DIRECT_URL must resolve to the same database.");
  }
}

function runNodeCli(relativePath, args, label) {
  const result = spawnSync(process.execPath, [resolve(relativePath), ...args], {
    env: process.env,
    stdio: "inherit"
  });

  if (result.error) fail(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} failed with exit code ${result.status ?? "unknown"}.`);
}

const vercelEnvironment = process.env.VERCEL_TARGET_ENV?.trim() || process.env.VERCEL_ENV?.trim() || "";
const isVercelBuild = process.env.VERCEL === "1" || Boolean(vercelEnvironment);
if (isVercelBuild && !["production", "preview", "development"].includes(vercelEnvironment)) {
  fail("Vercel must expose VERCEL_ENV or VERCEL_TARGET_ENV before building.");
}

const isVercelProduction = vercelEnvironment === "production";
let migrationGate = "not-applicable";
let cronSecretGate = "not-applicable";

if (isVercelProduction) {
  validateCronSecret();
  cronSecretGate = "passed";
  validateProductionDatabaseTarget();
  console.log("[production-build] Database target verified; applying committed Prisma migrations.");
  runNodeCli("node_modules/prisma/build/index.js", ["migrate", "deploy"], "Prisma migration deployment");
  migrationGate = "passed";
}

process.env.NEXT_PUBLIC_PRODUCTION_MIGRATION_GATE = migrationGate;
process.env.NEXT_PUBLIC_PRODUCTION_CRON_GATE = cronSecretGate;
process.env.NEXT_PUBLIC_RELEASE_COMMIT = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || "local";

runNodeCli("node_modules/next/dist/bin/next", ["build"], "Next.js production build");
