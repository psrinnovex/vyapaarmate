import { existsSync, readFileSync } from "node:fs";

function loadLocalEnv() {
  if (!existsSync(".env")) return;

  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] ??= value;
  }
}

loadLocalEnv();

const errors = [];
const warnings = [];
const required = (name, minimumLength = 1) => {
  const value = process.env[name]?.trim();
  if (!value || value.length < minimumLength) {
    errors.push(`${name} must be set${minimumLength > 1 ? ` and at least ${minimumLength} characters` : ""}.`);
  }
  return value;
};
const optional = (name) => process.env[name]?.trim() || "";

const appUrl = required("NEXT_PUBLIC_APP_URL");
required("JWT_SECRET", 32);
required("ENCRYPTION_KEY", 32);
required("CRON_SECRET", 32);
const databaseUrl = required("DATABASE_URL");
const directUrl = required("DIRECT_URL");
const redisRestUrl = required("UPSTASH_REDIS_REST_URL");
required("UPSTASH_REDIS_REST_TOKEN", 20);
if (!optional("GOOGLE_PLACES_API_KEY") && !optional("GOOGLE_MAPS_API_KEY")) {
  errors.push("Set GOOGLE_PLACES_API_KEY or GOOGLE_MAPS_API_KEY for Google Places location search.");
}
required("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");

required("EMAIL_FROM");
if (!optional("RESEND_API_KEY") && !optional("EMAIL_API_KEY")) {
  errors.push("Set RESEND_API_KEY (or the EMAIL_API_KEY compatibility alias) for registration email verification.");
}
const smsVerificationEnabled = optional("SMS_VERIFICATION_ENABLED") === "true";
if (smsVerificationEnabled) {
  for (const name of ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_VERIFY_SERVICE_SID"]) {
    required(name);
  }
} else {
  warnings.push("SMS verification is disabled. Phone numbers remain unique, but ownership is not verified by SMS OTP.");
}

if (appUrl) {
  try {
    const url = new URL(appUrl);
    if (url.protocol !== "https:") errors.push("NEXT_PUBLIC_APP_URL must use https in production.");
    if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
      errors.push("NEXT_PUBLIC_APP_URL must use the production domain, not localhost.");
    }
  } catch {
    errors.push("NEXT_PUBLIC_APP_URL must be a valid absolute URL.");
  }
}

if (databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
      errors.push("DATABASE_URL must be a PostgreSQL connection URL.");
    }
    if (url.searchParams.get("sslmode") !== "require") {
      errors.push("DATABASE_URL must include sslmode=require.");
    }
    if (url.hostname.endsWith(".pooler.supabase.com")) {
      if (url.port !== "6543") {
        errors.push("Vercel DATABASE_URL should use the Supabase Transaction Pooler on port 6543.");
      }
      if (url.searchParams.get("pgbouncer") !== "true") {
        errors.push("Supabase Transaction Pooler URLs used by Prisma must include pgbouncer=true.");
      }
      const connectionLimit = Number(url.searchParams.get("connection_limit"));
      if (!url.searchParams.has("connection_limit")) {
        warnings.push("Add connection_limit=5 to DATABASE_URL initially, then tune it from production metrics.");
      } else if (!Number.isInteger(connectionLimit) || connectionLimit < 1) {
        warnings.push("DATABASE_URL connection_limit should be a positive whole number.");
      } else if (connectionLimit < 3) {
        warnings.push("DATABASE_URL connection_limit below 3 can starve SSR page loads while live sync requests are open.");
      }
      if (!url.searchParams.has("pool_timeout")) {
        warnings.push("Add pool_timeout=30 to DATABASE_URL so brief Supabase pool contention does not fail user-facing pages.");
      }
    }
  } catch {
    errors.push("DATABASE_URL must be a valid URL.");
  }
}

if (directUrl) {
  try {
    const url = new URL(directUrl);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
      errors.push("DIRECT_URL must be a PostgreSQL connection URL.");
    }
    if (url.searchParams.get("sslmode") !== "require") {
      errors.push("DIRECT_URL must include sslmode=require.");
    }
    if (url.searchParams.get("pgbouncer") === "true") {
      errors.push("DIRECT_URL is for migrations and must not use pgbouncer=true.");
    }
    if (url.hostname.endsWith(".pooler.supabase.com") && url.port !== "5432") {
      errors.push("DIRECT_URL should use the Supabase Session Pooler on port 5432, or the direct database host.");
    }
  } catch {
    errors.push("DIRECT_URL must be a valid URL.");
  }
}

if (redisRestUrl) {
  try {
    const url = new URL(redisRestUrl);
    if (url.protocol !== "https:") {
      errors.push("UPSTASH_REDIS_REST_URL must use https.");
    }
  } catch {
    errors.push("UPSTASH_REDIS_REST_URL must be a valid absolute URL.");
  }
}
if (optional("RATE_LIMIT_FAIL_OPEN").toLowerCase() === "true") {
  errors.push("RATE_LIMIT_FAIL_OPEN must not be true in production.");
}

for (const origin of optional("TRUSTED_ORIGINS").split(",").map((value) => value.trim()).filter(Boolean)) {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:") errors.push(`TRUSTED_ORIGINS entry must use https: ${origin}`);
  } catch {
    errors.push(`TRUSTED_ORIGINS contains an invalid origin: ${origin}`);
  }
}

required("PAYMENT_RECEIVER_NAME");

const cashfreeKeys = ["CASHFREE_APP_ID", "CASHFREE_SECRET_KEY"];
const configuredCashfreeKeys = cashfreeKeys.filter((name) => process.env[name]?.trim());
if (configuredCashfreeKeys.length > 0 && configuredCashfreeKeys.length !== cashfreeKeys.length) {
  errors.push("Cashfree requires CASHFREE_APP_ID and CASHFREE_SECRET_KEY together.");
}
for (const name of cashfreeKeys) required(name);
if (optional("CASHFREE_ENV").toLowerCase() !== "production") {
  warnings.push("Cashfree is not in production mode. Set CASHFREE_ENV=production before accepting real payments.");
}
if (optional("CASHFREE_SPLIT_ENABLED").toLowerCase() === "true") {
  errors.push("CASHFREE_SPLIT_ENABLED must stay false for the PSHR platform-wallet flow.");
}

const cashfreePayoutKeys = ["CASHFREE_PAYOUTS_CLIENT_ID", "CASHFREE_PAYOUTS_CLIENT_SECRET"];
const configuredCashfreePayoutKeys = cashfreePayoutKeys.filter((name) => process.env[name]?.trim());
const cashfreePayoutsEnabled = optional("CASHFREE_PAYOUTS_AUTO_ENABLED").toLowerCase() === "true";
if (configuredCashfreePayoutKeys.length > 0 && configuredCashfreePayoutKeys.length !== cashfreePayoutKeys.length) {
  errors.push("Cashfree Payouts requires CASHFREE_PAYOUTS_CLIENT_ID and CASHFREE_PAYOUTS_CLIENT_SECRET together.");
}
if (cashfreePayoutsEnabled) {
  for (const name of cashfreePayoutKeys) required(name);
  required("CASHFREE_PAYOUTS_WEBHOOK_SECRET", 16);
  if (optional("CASHFREE_PAYOUTS_ENV").toLowerCase() !== "production") {
    warnings.push("Cashfree Payouts is not in production mode. Set CASHFREE_PAYOUTS_ENV=production before real business payouts.");
  }
  if (!optional("CASHFREE_PAYOUTS_PUBLIC_KEY")) {
    warnings.push("Cashfree Payouts public key is not set. Ensure your production runtime outbound IP is whitelisted by Cashfree, or set CASHFREE_PAYOUTS_PUBLIC_KEY for x-cf-signature.");
  }
  if (optional("CASHFREE_PAYOUTS_WEBHOOK_ALLOW_UNSIGNED").toLowerCase() === "true") {
    errors.push("CASHFREE_PAYOUTS_WEBHOOK_ALLOW_UNSIGNED must not be true in production.");
  }
}

const cashfreeCurrency = optional("CASHFREE_CURRENCY").toUpperCase();
if (cashfreeCurrency && cashfreeCurrency !== "INR") {
  errors.push("CASHFREE_CURRENCY must be INR for the current wallet accounting flow.");
}

const checkoutExpiryMinutes = optional("PAYMENT_CHECKOUT_EXPIRES_MINUTES");
if (checkoutExpiryMinutes) {
  const parsedCheckoutExpiryMinutes = Number(checkoutExpiryMinutes);
  if (
    !Number.isInteger(parsedCheckoutExpiryMinutes) ||
    parsedCheckoutExpiryMinutes < 16 ||
    parsedCheckoutExpiryMinutes > 1440
  ) {
    errors.push("PAYMENT_CHECKOUT_EXPIRES_MINUTES must be a whole number from 16 to 1440.");
  }
}

const settlementDays = Number(optional("PAYMENT_PROVIDER_SETTLEMENT_DAYS"));
if (!Number.isInteger(settlementDays) || settlementDays < 0 || settlementDays > 30) {
  errors.push("PAYMENT_PROVIDER_SETTLEMENT_DAYS must be a whole number from 0 to 30. Use 0 for the daily 9 AM IST payout batch within 24 hours.");
}

const minimumPayoutAmount = optional("CASHFREE_PAYOUTS_MIN_AMOUNT");
if (minimumPayoutAmount) {
  const parsedMinimumPayoutAmount = Number(minimumPayoutAmount);
  if (!Number.isFinite(parsedMinimumPayoutAmount) || parsedMinimumPayoutAmount < 1) {
    errors.push("CASHFREE_PAYOUTS_MIN_AMOUNT must be at least 1.");
  }
}

const whatsappLiveSendsEnabled = process.env.WHATSAPP_LIVE_SENDS_ENABLED === "true";
if (whatsappLiveSendsEnabled) {
  required("WHATSAPP_ACCESS_TOKEN", 20);
  required("WHATSAPP_PHONE_NUMBER_ID");
  const whatsappVerifyToken = required("WHATSAPP_WEBHOOK_VERIFY_TOKEN", 16);
  required("WHATSAPP_APP_SECRET", 16);
  if (whatsappVerifyToken === "local-dev-only") {
    errors.push("WHATSAPP_WEBHOOK_VERIFY_TOKEN must be a production random token, not local-dev-only.");
  }
} else if (!optional("WHATSAPP_APP_SECRET")) {
  warnings.push("WhatsApp live sends are disabled. Production WhatsApp webhooks will reject POST requests until WHATSAPP_APP_SECRET is set.");
}

const gtmId = optional("NEXT_PUBLIC_GTM_ID");
const gaMeasurementId = optional("NEXT_PUBLIC_GA_MEASUREMENT_ID");

if (gtmId && !/^GTM-[A-Z0-9]+$/i.test(gtmId)) {
  errors.push("NEXT_PUBLIC_GTM_ID must look like GTM-XXXXXXX.");
}
if (gaMeasurementId && !/^G-[A-Z0-9]+$/i.test(gaMeasurementId)) {
  errors.push("NEXT_PUBLIC_GA_MEASUREMENT_ID must look like G-XXXXXXXXXX.");
}
if (gtmId && gaMeasurementId) {
  warnings.push("NEXT_PUBLIC_GTM_ID takes precedence over standalone NEXT_PUBLIC_GA_MEASUREMENT_ID. Configure GA4 inside GTM or unset GTM.");
}
if (!gtmId && !gaMeasurementId) {
  warnings.push("Analytics is not configured. Add NEXT_PUBLIC_GA_MEASUREMENT_ID after creating the GA4 web data stream.");
}

for (const warning of warnings) console.warn(`WARNING: ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exitCode = 1;
} else {
  console.log("Production environment looks ready.");
}
