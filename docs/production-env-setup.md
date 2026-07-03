# Production Environment Setup

Status: required before deployment

`npm run production:check` intentionally fails until real production values are present. Do not make it pass with copied placeholders. Put production secrets in the deployment provider environment, not in git.

## Core App

- `NEXT_PUBLIC_APP_URL`: deployed HTTPS origin, for example `https://vyapaarmate.com`.
- `JWT_SECRET`: random 32+ character server-only secret used to sign app session cookies.
- `ENCRYPTION_KEY`: random 32+ character server-only secret for encrypted fields.
- `TRUSTED_ORIGINS`: comma-separated extra HTTPS origins allowed for unsafe API requests, if any.

Generate random secrets with a password manager or:

```sh
openssl rand -base64 48
```

## Supabase PostgreSQL

Get these from Supabase Dashboard -> Project Settings -> Database -> Connection string.

- `DATABASE_URL`: runtime Prisma URL. Use the Supabase Transaction Pooler on port `6543` with `sslmode=require`, `pgbouncer=true`, `connection_limit=5`, and `pool_timeout=30`.
- `DIRECT_URL`: migration URL. Use the Supabase Session Pooler on port `5432` or direct database host with `sslmode=require`; do not include `pgbouncer=true`.
- `LIVE_DATABASE_URL`: optional dedicated session-capable URL for LISTEN/NOTIFY live streams.

Supabase notes checked on 2026-07-03:
- Supabase support for Postgres 14 was removed on July 1, 2026. Use a supported Postgres version.
- New tables may not be exposed to the Data/GraphQL API automatically. This app currently uses server-side Prisma and keeps Supabase table API access locked down unless a future migration intentionally grants it.

## Upstash Redis

Create an Upstash Redis database for shared rate limiting.

- `UPSTASH_REDIS_REST_URL`: Upstash REST URL.
- `UPSTASH_REDIS_REST_TOKEN`: Upstash REST token.
- `RATE_LIMIT_FAIL_OPEN`: keep `false` in production.

## Google Maps And Places

Create keys in Google Cloud Console -> Google Maps Platform.

- `GOOGLE_PLACES_API_KEY`: preferred server-side key with Places API enabled. Restrict by server/runtime where possible.
- `GOOGLE_MAPS_API_KEY`: accepted compatibility alias for the same server-side Places key when the deployment names it this way.
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`: browser key for Maps JavaScript API. Restrict by production domain.
- `GOOGLE_PLACES_REGION_CODE`: use `IN` for India.
- `GOOGLE_PLACES_LANGUAGE_CODE`: use `en` unless another language is required.

## Email And SMS

- `EMAIL_FROM`: verified sender, for example `VyapaarMate <orders@your-domain>`.
- `RESEND_API_KEY` or `EMAIL_API_KEY`: email provider API key for verification and reset emails.
- `SMS_VERIFICATION_ENABLED`: set `true` only after Twilio Verify is configured.
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`: required when SMS verification is enabled.

## Cashfree Payments

Get production credentials from Cashfree after production KYC approval.

- `CASHFREE_ENV=production`
- `CASHFREE_APP_ID`
- `CASHFREE_SECRET_KEY`
- `CASHFREE_CURRENCY=INR`
- `CASHFREE_SPLIT_ENABLED=false`
- `PAYMENT_CHECKOUT_EXPIRES_MINUTES`: whole number from 16 to 1440.
- `PAYMENT_PROVIDER_SETTLEMENT_DAYS`: whole number from 0 to 30. Current platform-wallet flow expects `0`.

Cashfree Payouts, only if automatic payouts are enabled:
- `CASHFREE_PAYOUTS_AUTO_ENABLED=true`
- `CASHFREE_PAYOUTS_ENV=production`
- `CASHFREE_PAYOUTS_CLIENT_ID`
- `CASHFREE_PAYOUTS_CLIENT_SECRET`
- `CASHFREE_PAYOUTS_WEBHOOK_SECRET`
- `CASHFREE_PAYOUTS_PUBLIC_KEY`: optional if Cashfree requires `x-cf-signature`.
- `CASHFREE_PAYOUTS_WEBHOOK_ALLOW_UNSIGNED=false`

## WhatsApp Cloud API

Get these from Meta for Developers / WhatsApp Manager.

- `WHATSAPP_LIVE_SENDS_ENABLED=true` only after templates, phone number, webhook, and opt-in handling are ready.
- `WHATSAPP_GRAPH_API_VERSION`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`: random 16+ character token configured in Meta webhook settings.
- `WHATSAPP_APP_SECRET`: Meta app secret for POST signature verification.
- `WHATSAPP_TEMPLATE_LANGUAGE`
- `WHATSAPP_BUSINESS_PHONE_MAP`: recommended for multi-business routing. Map Meta phone number IDs or display phone digits to a business slug/id.
- `WHATSAPP_DEFAULT_BUSINESS_SLUG`: only set for a deliberate single-number setup.

## Cron And Jobs

- `CRON_SECRET`: random 32+ character value.

Configure the cron provider to send:

```text
Authorization: Bearer $CRON_SECRET
```

Protected job routes:
- `/api/jobs/automatic-payouts`
- `/api/jobs/intelligence-refresh`
- `/api/jobs/payment-reconciliation`
- `/api/jobs/payment-reminders`
- `/api/jobs/payment-transfers`

## Analytics And SEO

- `NEXT_PUBLIC_GA_MEASUREMENT_ID`: GA4 measurement ID, or
- `NEXT_PUBLIC_GTM_ID`: GTM container ID. If GTM is set, configure GA4 inside GTM.
- Search engine verification values are optional and should come from DNS/search-console setup.

## Required Verification

Run this before deployment:

```sh
npm run production:check
```

Passing this command only means environment shape is acceptable. It does not replace sandbox/live Cashfree, WhatsApp webhook, Supabase migration, or end-to-end product verification.
