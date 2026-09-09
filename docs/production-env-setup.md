# Production Environment Setup

Status: required before deployment

`npm run production:check` intentionally fails until real production values are present. Do not make it pass with copied placeholders. Put production secrets in the deployment provider environment, not in git.

## Core App

- `NEXT_PUBLIC_APP_URL`: deployed HTTPS origin, for example `https://www.vyapaarmate.com`.
- `JWT_SECRET`: random 32+ character server-only secret used to sign app session cookies.
- `MOBILE_JWT_SECRET`: separate random 32+ byte server-only secret used only for 10-minute native access JWTs.
- `MOBILE_TOKEN_PEPPER`: separate random 32+ byte server-only HMAC pepper for native authorization codes and rotating refresh tokens.
- `MOBILE_TOKEN_ISSUER=https://www.vyapaarmate.com`: exact production issuer checked in every native access token.
- `ACCOUNT_DELETION_TOKEN_PEPPER`: separate random 32+ byte server-only HMAC pepper for single-use post-uninstall deletion links.
- `ACCOUNT_RETENTION_POLICY_APPROVED_VERSION=2026-08-17`: release gate. Set it only after the owner and qualified counsel approve that exact retention notice and its category-by-category schedule. The deletion cron refuses final retained-record purges when the stored request version does not exactly match this value.
- `ENCRYPTION_KEY`: random 32+ character server-only secret for encrypted fields.
- `TRUSTED_ORIGINS`: comma-separated extra HTTPS origins allowed for unsafe API requests, if any.

Generate random secrets with a password manager or:

```sh
openssl rand -base64 48
```

Never expose these secrets, Prisma database credentials, Supabase service-role keys, or Supabase database URLs in the native bundle. Rotate each mobile/deletion secret independently during an incident: changing `MOBILE_JWT_SECRET` invalidates access tokens, changing `MOBILE_TOKEN_PEPPER` invalidates authorization codes and refresh tokens, and changing `ACCOUNT_DELETION_TOKEN_PEPPER` invalidates pending deletion-email links. A planned rotation therefore requires users with affected credentials to authenticate or request deletion again. Do not reuse `JWT_SECRET` for any of them.

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

## Launch Market And Subscription Offer

Set these explicitly in Preview and Production. The application has safe defaults, but an explicit production value prevents an accidental city expansion or offer change during a later code update.

- `NEXT_PUBLIC_LAUNCH_MARKET=pilot-cohorts`: enable separate Bengaluru and Andhra Pradesh pilot cohorts across onboarding, billing, discovery and orders. Use `bengaluru` for single-city operation or `all` for national onboarding. AP map bounds are a coarse sanity check; verify the actual operating address during KYC.
- `NEXT_PUBLIC_BENGALURU_LAUNCH_OFFER=true`: apply the automatic 80% Bengaluru subscription discount to future checkouts. Set `false` to end the offer after updating public copy and QA.
- `SUBSCRIPTION_GST_RATE_BPS=1800`: current configured subscription GST rate in basis points. Confirm the applicable tax treatment with the company accountant before accepting live payments.

See `docs/bengaluru-launch-operations.md` for the complete commercial policy, service radius, exclusions, expansion behavior, and launch QA matrix.

## Chatbot And AI Provider

The production chatbot is rules-based unless an allowlisted provider implementation is deliberately added.

- `AI_PROVIDER_ENABLED=false`: keep disabled by default.
- `AI_PROVIDER_NAME`: optional provider label for future reviewed integrations.
- `AI_PROVIDER_MODEL`: optional model label for future reviewed integrations.
- `CHATBOT_STORE_RAW_MESSAGES=false`: default redacted transcript storage. Set `true` only after explicit privacy/legal approval.
- `CHATBOT_TRANSCRIPT_RETENTION_DAYS=30`: retention target for chatbot/support transcripts. Use 1-365 days.

Do not send secrets, full database rows, payment/KYC/bank data, or broad customer/business records to any external AI provider.

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
- `APPOINTMENT_REMINDER_HOURS`: reminder lead time in hours; defaults to `24`.

Configure the cron provider to send:

```text
Authorization: Bearer $CRON_SECRET
```

Protected job routes:
- `/api/jobs/automatic-payouts`
- `/api/jobs/intelligence-refresh`
- `/api/jobs/payment-reconciliation`
- `/api/jobs/payment-reminders`
- `/api/jobs/appointment-reminders`
- `/api/jobs/account-deletions` (run daily; finalizes verified business deletions whose 30-day waiting period has elapsed)
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
