# VyapaarMate

VyapaarMate by PSHR INNOVEX PRIVATE LIMITED is a website ordering, UPI payment, WhatsApp notification, and customer management SaaS app for Indian small businesses such as restaurants, tiffin centers, cloud kitchens, home bakers, salons, juice shops, PG food providers, and local retailers.

It includes a polished landing page, website checkout and invoices, WhatsApp order notifications, business owner dashboard, PSHR Innovex super admin panel, Prisma PostgreSQL schema, auth/RBAC structure, API routes, integration placeholders, seed data, and security controls.

## Demo Credentials

Local development only. Change all credentials and secrets before production.

Admin:

- Email: `admin@pshrinnovex.com`
- Password: `ChangeMe123!`

Business owner:

- Email: `owner@demo.com`
- Password: `ChangeMe123!`

## Tech Stack

- Next.js App Router, React, TypeScript
- Tailwind CSS with custom clean UI components
- Framer Motion
- React Three Fiber / Three.js
- PostgreSQL with Prisma ORM
- JWT session cookie auth, bcrypt password hashing
- Zod validation, RBAC, tenant isolation, rate limiting, audit logs
- Cashfree, WhatsApp Cloud API, email, SMS, and storage placeholders

## Main Routes

- Public: `/`, `/pricing`, `/features`, `/contact`, `/privacy`, `/terms`, `/b/sri-sai-tiffins`
- Auth: `/login`, `/register`, `/forgot-password`, `/reset-password`
- Business dashboard: `/dashboard`, `/dashboard/orders`, `/dashboard/menu`, `/dashboard/customers`, `/dashboard/payments`, `/dashboard/campaigns`, `/dashboard/staff`, `/dashboard/reports`, `/dashboard/settings`, `/dashboard/billing`
- PSHR admin: `/admin`, `/admin/businesses`, `/admin/orders`, `/admin/payments`, `/admin/subscriptions`, `/admin/support`, `/admin/logs`, `/admin/settings`

## Folder Structure

```text
app/
  api/
    auth/
    orders/
    dashboard/
    admin/
    webhooks/
  b/[slug]/
  dashboard/
  admin/
components/
  admin/
  auth/
  dashboard/
  landing/
  order/
  ui/
lib/
  auth.ts
  session.ts
  rbac.ts
  validations.ts
  rate-limit.ts
  prisma.ts
  audit.ts
  crypto.ts
prisma/
  schema.prisma
  seed.ts
services/
  cashfree.ts
  whatsapp.ts
  email.ts
  sms.ts
  storage.ts
proxy.ts
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

3. Update `.env` with Supabase PostgreSQL URLs, a long `JWT_SECRET`, and an `ENCRYPTION_KEY`.

   Use separate Prisma URLs:

   - `DATABASE_URL`: Supabase Transaction Pooler for app runtime on Vercel/serverless, port `6543`, with `pgbouncer=true`.
   - `DIRECT_URL`: Supabase Session Pooler on port `5432` or the direct database host for Prisma migrations and Studio.

   Example serverless runtime URL:

   ```bash
   postgresql://postgres.YOUR-PROJECT:YOUR-PASSWORD@aws-0-YOUR-REGION.pooler.supabase.com:6543/postgres?schema=public&sslmode=require&pgbouncer=true&connection_limit=5&pool_timeout=30
   ```

   Example migration URL:

   ```bash
   postgresql://postgres.YOUR-PROJECT:YOUR-PASSWORD@aws-0-YOUR-REGION.pooler.supabase.com:5432/postgres?schema=public&sslmode=require
   ```

   Replace `YOUR-PASSWORD`, `YOUR-PROJECT`, and `YOUR-REGION` with values from Supabase Dashboard -> Connect. If you use the direct `db.YOUR-PROJECT.supabase.co` host for `DIRECT_URL`, your network needs IPv6 or the Supabase IPv4 add-on.

   Business setup and settings use Google Maps only. Set `GOOGLE_PLACES_API_KEY` to a server-side Google Maps Platform key with Places API enabled for address search, and set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to a browser-restricted key with Maps JavaScript API enabled for map rendering. `GOOGLE_PLACES_REGION_CODE` defaults to `IN`.

   For production, create an Upstash Redis database and set `UPSTASH_REDIS_REST_URL` plus `UPSTASH_REDIS_REST_TOKEN`. This keeps login, registration, order, chatbot, payment refresh, and location-search limits shared across Vercel serverless instances.

4. Generate Prisma Client:

```bash
npm run db:generate
```

5. Run migrations and seed demo data:

```bash
npm run db:migrate
npm run db:seed
```

6. Start development:

```bash
npm run dev
```

## Messaging Setup

### WhatsApp Cloud API

The recommended website customer flow keeps payment on the website:

1. Business owner registers and enters only the WhatsApp Business display number in `/dashboard/settings`.
2. PSHR admin approves the business account.
3. PSHR admin enters the Meta Cloud API details and approves WhatsApp live sends for that business from `/admin/businesses`.
4. Customer places an order at `/b/[slug]` and chooses platform online payment or cash.
5. VyapaarMate opens a secure `/order/[publicToken]` page for payment status and the customer invoice.
6. WhatsApp sends the order confirmation and later business status updates. Payment QR and invoice details stay on the secure website order page.

WhatsApp-started catalog conversations remain supported separately. Website-started orders always complete payment on the secure website order page. Customer online order payments use the PSHR Innovex Cashfree merchant account so payment success is verified automatically by webhook.

The order API saves website-started requests, creates a platform payment request, returns a secure website order URL, and sends the `order_received` WhatsApp template when credentials are configured. Cashfree webhook confirmation marks online order payments completed, credits the business wallet, updates the customer invoice, and can trigger WhatsApp status updates. Cash rows can still be confirmed from `/dashboard/payments`. The WhatsApp webhook continues to handle WhatsApp-started catalog conversations separately.

1. In Meta Business / WhatsApp Manager, create or connect a WhatsApp Business phone number.
2. Create these approved templates:
   - `order_received` with 6 body variables: customer name, order number, business name, item summary, total, payment method.
   - `order_status_update` with 6 body variables: customer name, order number, status, business name, total, payment state.
   - `payment_pending_reminder` with 4 body variables: customer name, order number, amount, secure website order URL.
   - Language must match `WHATSAPP_TEMPLATE_LANGUAGE` in `.env`.
3. Create a permanent access token for the WhatsApp app/system user.
4. Set these env vars:

```bash
WHATSAPP_LIVE_SENDS_ENABLED=false
WHATSAPP_GRAPH_API_VERSION=v23.0
WHATSAPP_ACCESS_TOKEN=your-meta-access-token
WHATSAPP_PHONE_NUMBER_ID=your-whatsapp-phone-number-id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=make-a-random-verify-token
WHATSAPP_APP_SECRET=your-meta-app-secret
WHATSAPP_TEMPLATE_LANGUAGE=en_US
WHATSAPP_DEFAULT_BUSINESS_SLUG=sri-sai-tiffins
# Optional for multi-number deployments:
# WHATSAPP_BUSINESS_PHONE_MAP={"123456789012345":"sri-sai-tiffins","+919876543210":"sweet-cravings-home-bakery"}
```

For a real multi-business deployment, business owners should only manage their WhatsApp display number. PSHR admins should save each business's `phone_number_id`, WABA ID, and encrypted access token from the admin console. The env map is kept as a local/testing fallback.

Leave `WHATSAPP_LIVE_SENDS_ENABLED=false` to keep global fallback WhatsApp credentials in local placeholder mode. Per-business Cloud API sends use the encrypted business credentials and only go live after PSHR admin approves WhatsApp for that business.

For inbound WhatsApp chats, the webhook resolves the business in this order: `WHATSAPP_BUSINESS_PHONE_MAP`, the incoming Meta `display_phone_number` matched to `Business.phone`, then `WHATSAPP_DEFAULT_BUSINESS_SLUG` as a local fallback. Map keys can be the Meta phone number id, the display phone with `+`, or the display phone digits only.

5. In Meta webhook settings, add this callback URL:

```bash
https://your-domain.com/api/webhooks/whatsapp
```

Use the same value as `WHATSAPP_WEBHOOK_VERIFY_TOKEN` when Meta asks for the verify token. For local testing, expose Next.js with a tunnel and use the tunnel URL.

After this:

- Website-started orders with WhatsApp opt-in send order and status templates and store Meta's returned message ids.
- Customer checkout stays on the website for platform online payment, automatic payment confirmation, and invoice access.
- WhatsApp-started chats can reply `hi` or `menu`, choose an item/service, build a cart, request salon/service appointments, and request a UPI QR by replying `pay`.
- Native WhatsApp catalog order payloads are accepted when product retailer IDs match `MenuItem.id`.
- Webhook delivery updates update `WhatsappMessage.status`.

For salons, spas, home services, classes, and other appointment-style businesses, selected services create a booking request and the next customer reply is stored on the order notes as the preferred date/time, address, or special instructions. The owner confirms the slot from WhatsApp or the dashboard.

To smoke test the WhatsApp-started flow locally against the database in `.env`, run:

```bash
npm run whatsapp:smoke
```

This sends simulated inbound WhatsApp `hi`, item selection, and `pay` events through the same commerce service used by the webhook. It creates a test customer, order, payment row, and WhatsApp message logs for the configured `WHATSAPP_DEFAULT_BUSINESS_SLUG`. Smoke tests use placeholder WhatsApp sends by default even when live sends are enabled. Set `WHATSAPP_SMOKE_LIVE_SENDS_ENABLED=true` only if you deliberately want a smoke test to call Meta. You can pass another business slug or id:

```bash
npm run whatsapp:smoke -- sweet-cravings-home-bakery
```

### Cashfree payments, subscriptions, and reminders

Customer order payments and platform subscription checkouts use the PSHR Innovex Cashfree gateway account. Admin direct UPI settings do not override Cashfree checkout.

- `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, and `CASHFREE_ENV` must be configured before online payment is offered to customers or business owners.
- Cashfree webhook events mark matching order and subscription payments as `COMPLETED` or `FAILED`; a later successful retry can replace an earlier failed attempt.
- Completed Cashfree order payments credit a business wallet entry. With `PAYMENT_PROVIDER_SETTLEMENT_DAYS=0`, wallet credits become payout-available in the next daily 9 AM IST batch within 24 hours; when Cashfree Payouts auto mode is enabled, the transfer to the saved business bank/UPI destination is sent automatically and reconciled by webhook/job.
- Cash payments remain pending until the business marks them paid in `/dashboard/payments`; cash is treated as business-collected, not platform wallet money.

Platform subscription checkout opens Cashfree hosted checkout. Cashfree webhook confirmation updates matching `Subscription` rows and activates the selected plan.

```bash
CASHFREE_ENV=sandbox
CASHFREE_APP_ID=your-cashfree-app-id
CASHFREE_SECRET_KEY=your-cashfree-secret-key
CASHFREE_CURRENCY=INR
PAYMENT_CHECKOUT_EXPIRES_MINUTES=30
PAYMENT_REMINDER_AFTER_MINUTES=20
# 0 means the next daily 9 AM IST payout batch, within 24 hours after online payment clears.
PAYMENT_PROVIDER_SETTLEMENT_DAYS=0
CRON_SECRET=replace-with-a-long-random-cron-secret
CASHFREE_PAYOUTS_ENV=sandbox
CASHFREE_PAYOUTS_CLIENT_ID=your-cashfree-payout-client-id
CASHFREE_PAYOUTS_CLIENT_SECRET=your-cashfree-payout-client-secret
CASHFREE_PAYOUTS_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
CASHFREE_PAYOUTS_AUTO_ENABLED=true
CASHFREE_PAYOUTS_WEBHOOK_SECRET=your-cashfree-payout-webhook-secret
```

Configure the Cashfree webhook callback as `https://your-domain.com/api/webhooks/cashfree` and enable payment success and payment failure events. The handler verifies the raw request body with `CASHFREE_SECRET_KEY` before changing order or subscription payment state.
Configure Cashfree Payouts callback separately as `https://your-domain.com/api/webhooks/cashfree-payouts` and enable transfer success, failure, reversed, and acknowledged events.
For live Cashfree Payouts API calls, use either Cashfree IP whitelisting or set `CASHFREE_PAYOUTS_PUBLIC_KEY` so the app can generate the required `x-cf-signature` header from serverless environments.

The scheduled job at `/api/jobs/payment-reminders` sends one WhatsApp template reminder for pending payments between 20 and 30 minutes. `/api/jobs/payment-transfers` reconciles missing wallet credits, releases wallet credits for the daily 9 AM IST payout batch, starts Cashfree automatic payouts when enabled, and reconciles in-flight payout transfers. `/api/jobs/intelligence-refresh` materializes the Bhojzo Intelligence Engine outputs into the AI insight, health snapshot, customer score, demand forecast, and payment priority tables, checks first-party ML readiness, trains when enough real business data exists and no recent valid model is available, generates ML predictions, and falls back to rules/statistical recommendations when data is insufficient. `vercel.json` schedules payment jobs every 10 minutes and intelligence refresh hourly; use a Vercel plan that supports this cadence or call the protected job endpoints from an external cron. In production, requests must include `Authorization: Bearer $CRON_SECRET`.

Bhojzo uses a hybrid intelligence engine. Where sufficient real business history exists, trained first-party ML models generate forecasts and risk scores. Where data is insufficient, Bhojzo falls back to explainable rules/statistical recommendations and marks the model as `needs_data`. Production ML trains only from `Business`, `MenuItem`, `MenuCategory`, `Order`, `OrderItem`, `Customer`, and `Payment`; no external datasets or synthetic production data are used.

Intelligence data lineage and model readiness can be reviewed from `/api/intelligence/data-sources`. Owner/admin model status is available at `/api/intelligence/model-status?businessId=...`, training can be started with `POST /api/intelligence/train`, and predictions are available at `/api/intelligence/predictions?businessId=...`. Intelligence accuracy can be reviewed from `/api/intelligence/accuracy?days=14`. See `docs/intelligence-data-sources-and-model-readiness.md` for the source/training policy and `docs/intelligence-accuracy-maintenance.md` for the metrics, quality gates, and maintenance workflow.

Order invoices are available at the opaque `/order/[publicToken]` URL and refresh automatically while online payment is pending. Authenticated business subscription invoices are available from `/dashboard/billing`. Cash orders remain pending until the business selects **Mark Paid** on `/dashboard/payments`.

### Email

Email sending uses Resend-compatible HTTP API from `services/email.ts`.

```bash
EMAIL_FROM="VyapaarMate <orders@yourdomain.com>"
RESEND_API_KEY=your-resend-api-key
```

Verify the sender domain in Resend before using a production `EMAIL_FROM`.
Registration sends a six-digit email code that expires after 10 minutes. Forgot-password requests send a one-time reset link that expires after 30 minutes and uses `NEXT_PUBLIC_APP_URL` for the link origin. Resend's free plan can be used within its current monthly and daily sending limits.

### Optional SMS OTP

SMS OTP is optional because real production SMS is carrier-billed. Keep it disabled to use email verification only while still enforcing unique business and user phone numbers.

```bash
SMS_VERIFICATION_ENABLED=false
```

If you later want paid SMS OTP, set `SMS_VERIFICATION_ENABLED=true` and configure Twilio Verify:

```bash
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_VERIFY_SERVICE_SID=your-verify-service-sid
```

For India production SMS, complete the provider's required sender/regulatory setup before launch.
Twilio trial units are suitable only for testing; production SMS is carrier-billed and is not permanently free.

When email variables are omitted outside production, registration uses a local email test code shown on the verification screen, and forgot-password shows a local reset link after a matching account is found. Production fails closed if email is missing. Owners cannot sign in until email verification succeeds. If `SMS_VERIFICATION_ENABLED=true`, phone verification is also required before sign-in.

## Verification

The project currently passes:

```bash
npm run lint
npm run typecheck
npm audit --audit-level=moderate
npm run build
```

## Deployment

The recommended production setup is Vercel for Next.js and Supabase for PostgreSQL. The current `vercel.json` places server functions in Vercel's Seoul region (`icn1`) because the configured Supabase project is in AWS `ap-northeast-2`.

### 1. Prepare the database

Keep a direct or Supabase Session Pooler URL on port `5432` in the local `.env`, then apply committed migrations from a trusted machine:

```bash
npm run db:deploy
```

Do not run `npm run db:seed` against production. The seed script deletes existing application data and creates public demo credentials.

The latest migrations also revoke Supabase generated Data API grants for app tables and enable RLS on existing public tables. Keep the Supabase Data API disabled unless you later expose a dedicated API schema with explicit grants and policies.

### 2. Configure Vercel

Create a Vercel project with the repository root as the Root Directory. Vercel detects Next.js automatically; keep the default install and build commands. Node `22.x` is pinned in `package.json`, and `postinstall` generates Prisma Client.

`vercel.json` schedules payment reminder and wallet transfer jobs every 10 minutes, plus `/api/jobs/intelligence-refresh` hourly. Use a Vercel plan that supports this cadence, or keep the endpoints protected and call them from an external scheduler with `Authorization: Bearer $CRON_SECRET`.

Set these variables for the Production environment:

- Required: `NEXT_PUBLIC_APP_URL`, `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- Payments: `CASHFREE_ENV`, `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_CURRENCY`, `PAYMENT_CHECKOUT_EXPIRES_MINUTES`, `PAYMENT_UPI_QR_EXPIRES_MINUTES`, `PAYMENT_REMINDER_AFTER_MINUTES`, `PAYMENT_PROVIDER_SETTLEMENT_DAYS`
- Automatic payouts: `CASHFREE_PAYOUTS_ENV`, `CASHFREE_PAYOUTS_CLIENT_ID`, `CASHFREE_PAYOUTS_CLIENT_SECRET`, `CASHFREE_PAYOUTS_PUBLIC_KEY`, `CASHFREE_PAYOUTS_AUTO_ENABLED`, `CASHFREE_PAYOUTS_MIN_AMOUNT`, `CASHFREE_PAYOUTS_BANK_TRANSFER_MODE`, `CASHFREE_PAYOUTS_WEBHOOK_SECRET`
- WhatsApp live sending: `WHATSAPP_LIVE_SENDS_ENABLED`, `WHATSAPP_GRAPH_API_VERSION`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_TEMPLATE_LANGUAGE`
- Search and marketing: prefer DNS domain verification; optional HTML fallback tokens are `GOOGLE_SITE_VERIFICATION` and `BING_SITE_VERIFICATION`. For analytics, set either `NEXT_PUBLIC_GTM_ID` or `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
- Optional: Resend, Twilio, Google Places, S3, and `TRUSTED_ORIGINS` variables from `.env.example`

For Vercel's serverless runtime, use the Supabase Transaction Pooler URL on port `6543` and include `sslmode=require`, `pgbouncer=true`, a small `connection_limit`, and `pool_timeout=30`. The portal renders SSR pages while live sync endpoints are open, so `connection_limit=5` is the recommended starting point unless Supabase metrics show the project needs a different value:

```text
postgresql://postgres.PROJECT:PASSWORD@aws-REGION.pooler.supabase.com:6543/postgres?schema=public&sslmode=require&pgbouncer=true&connection_limit=5&pool_timeout=30
```

Set `NEXT_PUBLIC_APP_URL` to the final HTTPS origin without a trailing slash, for example `https://vyapaarmate.com`. Generate a different random value for each secret; do not copy local or demo secrets into production.

Before deploying, validate the production values locally using a temporary production `.env`:

```bash
npm run production:check
npm run verify
```

### 3. Publish and connect services

Deploy to Vercel, attach the custom domain, then update `NEXT_PUBLIC_APP_URL` if the final domain changed and redeploy.

Configure provider callbacks using the final domain:

- Cashfree: `https://YOUR-DOMAIN/api/webhooks/cashfree`
- Meta WhatsApp: `https://YOUR-DOMAIN/api/webhooks/whatsapp`

Use the same production webhook secrets in Vercel and each provider dashboard. After deployment, verify registration, login, a test order, Cashfree test payment confirmation, WhatsApp webhook verification, and the protected cron endpoint.

For search launch, follow `docs/seo-launch-checklist.md`. The recommended setup is Google Search Console DNS verification at the domain's DNS provider, Bing import from Search Console, and direct GA4 through `NEXT_PUBLIC_GA_MEASUREMENT_ID`. Run `npm run seo:check -- https://YOUR-DOMAIN` after deployment.

## Live Sync

- Owner dashboards use `/api/dashboard/live` for authenticated JSON refreshes and `/api/dashboard/live?stream=1` for server-sent live updates.
- Admin screens use `/api/admin/live` and `/api/admin/live?stream=1`.
- The browser never receives database credentials or service keys; the Next.js API streams tenant-scoped Prisma payloads using the existing JWT session cookie.
- Public ordering pages load live menu data from PostgreSQL by slug, save the request, and hand the customer into WhatsApp with the order details.
- New orders now create matching `Payment` and `WhatsappMessage` rows so dashboards, admin metrics, pending payment totals, and message counts stay in sync.

## Security Checklist

See `SECURITY.md` for the production checklist covering RBAC, tenant isolation, consent, webhook verification, encrypted secrets, audit logs, secure headers, and provider configuration.
