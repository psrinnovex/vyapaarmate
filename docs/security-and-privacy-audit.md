# Security And Privacy Audit

Date: 2026-07-03  
Overall status: warning - security foundation is strong but needs route-level and live-provider verification

## Summary

Security controls are present in the right places: signed HTTP-only session cookies, server-side session revalidation, role and tenant helpers, protected portal proxy rules, webhook signature checks, cron secret checks, secure response helpers, safe logging utilities, production env checks, and Supabase Data API lock-down.

The project should not be described as fully secure or unhackable. Remaining risks include incomplete dynamic authorization tests across every API, unverified live Supabase/RLS behavior, protected browser verification blocked by missing audit users in the connected database, PII exposure by public order receipt links, sensitive payout/bank data storage requirements, and live Cashfree/WhatsApp verification not yet executed.

## Files Reviewed

- `proxy.ts`
- `next.config.mjs`
- `.env.example`
- `lib/session.ts`, `lib/api-session.ts`, `lib/rbac.ts`
- `lib/security/authz.ts`, `lib/security/cron.ts`, `lib/security/safe-logger.ts`
- `lib/chatbot/*`, `lib/support-chatbot.ts`, `lib/support-tickets.ts`, `lib/support-chat.ts`, `lib/support-agent-queue.ts`
- `app/api/webhooks/cashfree/route.ts`, `app/api/webhooks/whatsapp/route.ts`
- `app/api/jobs/*/route.ts`
- `app/api/business-images/[businessId]/route.ts`, `app/api/menu-images/[itemId]/route.ts`
- `services/cashfree.ts`, `services/whatsapp.ts`, `services/whatsapp-commerce.ts`
- `prisma/schema.prisma`
- `supabase/migrations/*`

## Authentication

Status: warning

Evidence:
- `lib/session.ts` signs HS256 JWT session cookies and requires a long `JWT_SECRET`.
- `lib/api-session.ts` revalidates the JWT subject against the database before API use.
- `proxy.ts` protects `/dashboard`, `/admin`, `/support`, and `/user` server-side.
- Auth routes exist for login, logout, registration, verification, forgot/reset password, and change password.

Issues:
- Full browser login/logout/forgot/reset journeys were not executed.
- Some API routes still parse raw JSON directly; malformed JSON should be normalized through shared safe parsing where practical.

## Authorization And RBAC

Status: warning

Evidence:
- `proxy.ts` restricts admin pages to `SUPER_ADMIN`, support pages to `SUPPORT_AGENT`, user pages to `CUSTOMER`, and dashboard pages to business roles with `businessId`.
- `lib/rbac.ts` limits manager/staff permissions; owner has `business:*`.
- `lib/security/authz.ts` centralizes tenant access checks and permits `SUPER_ADMIN` platform access.
- `test:security` passed RBAC, tenant access, cron secret, and safe logging tests.

Issues:
- Static review found good patterns, but every `app/api` route was not dynamically fuzzed for IDOR or mass-assignment.
- Support page proxy allows only `SUPPORT_AGENT` for `/support`; super admins use `/admin/support`.

## Multi-Tenant Isolation

Status: warning

Evidence:
- Business APIs commonly use `requireBusinessSession()` and server-derived `businessId`.
- `canAccessBusiness()` rejects cross-business access for non-admin users.
- Non-public image routes now require session plus tenant access.

Fix implemented:
- `/api/business-images/[businessId]` and `/api/menu-images/[itemId]` now return public cache only for active, verified, active-subscription, approved-KYC businesses; otherwise they require authorized tenant/admin access and use private caching.

Remaining risk:
- Full route-by-route dynamic IDOR testing remains required before release.

## API Security

Status: warning

Evidence:
- `proxy.ts` blocks cross-origin unsafe API requests except webhooks and jobs.
- `lib/security/api-response.ts` provides safe API responses.
- `rg` found no `$queryRaw`, `$executeRaw`, `queryRawUnsafe`, or `executeRawUnsafe` matches in app/lib/services/scripts/prisma/supabase.
- `npm test` passed and now covers security, payments/business rules, chatbot/support, business intelligence, and ML governance suites.

Issues:
- Not every sensitive route has a dedicated auth/validation test.

## Webhook Security

Status: warning

Cashfree evidence:
- `/api/webhooks/cashfree` verifies `x-webhook-signature` and timestamp before parsing.
- Payment completion checks amount and currency with `gatewayPaymentMatches()`.
- Payment tests pass signature, amount, payout, and checkout rules.

WhatsApp evidence:
- `/api/webhooks/whatsapp` verifies GET challenge tokens and POST `x-hub-signature-256`.
- Unsafe fallback tenant routing was removed from `services/whatsapp-commerce.ts`.

Remaining risk:
- Live/sandbox webhook delivery was not executed.
- Cashfree payout webhook route was inspected indirectly through tests, but production provider verification still needs a real callback run.

## Job Route Security

Status: pass with manual verification required

Evidence:
- `lib/security/cron.ts` authorizes job routes with `Authorization: Bearer $CRON_SECRET` using constant-time comparison.
- `scripts/check-production-env.mjs` requires a 32-character `CRON_SECRET`.
- Job routes reviewed: automatic payouts, intelligence refresh, payment reconciliation, payment reminders, payment transfers.

Manual verification:
- Configure the production cron provider and verify rejected requests without the bearer token.

## Database And Supabase Security

Status: warning

Evidence:
- `supabase/migrations/20260623160000_lock_down_supabase_data_api.sql` revokes public/API role privileges and enables RLS on all public tables.
- The app uses server-side Prisma rather than browser-side Supabase table access.
- Supabase changelog reviewed on 2026-07-03; relevant items include Postgres 14 support removal on July 1, 2026 and Data/GraphQL API exposure behavior changes.

Issues:
- RLS/policy state was not verified against a live Supabase project.
- Sensitive business payout/bank details require strict production encryption, access logging, and retention decisions.
- Broad cascade behavior in Prisma means business deletion is high impact and must remain admin-only with audit logs.

## Privacy And PII

Status: warning

Evidence:
- `lib/security/safe-logger.ts` masks emails, phones, tokens, signatures, passwords, UPI/account/IFSC-like values.
- `lib/chatbot/chatbot-redaction.ts` masks chatbot/support transcript emails, phones, bearer tokens, JWTs, card-like values, UPI IDs, IFSC-like references, and OTP/CVV/password/API-key style values.
- Admin UI uses `maskEmail` and `maskPhone` in reviewed support/admin code.
- `.env.example` no longer contains concrete Cashfree payout credentials.
- Chatbot raw transcript storage is opt-in through `CHATBOT_STORE_RAW_MESSAGES=true`; default storage is redacted.

Issues:
- Public order receipt URLs expose customer/order details to anyone holding an unguessable token; this is acceptable only if documented and tokens remain high entropy.
- Postgres live notification payloads include customer phone/email for server-side filtering; raw PII exists in DB notification payloads even if not browser-exposed.
- Account deletion is handled by support instruction, not an in-app flow.

## Chatbot And Support Handoff

Status: warning with stronger baseline

Evidence:
- `/api/chatbot` now builds a server-derived chatbot security context, applies prompt-injection and data-leak guardrails before classification, gates intents by mode/role, and uses safe logging.
- The current chatbot remains rules-based; `AI_PROVIDER_ENABLED=false` is documented as the default.
- Support handoff uses a server-side helper with stricter rate limits and audit logging. The bot can request handoff but cannot select an agent from raw output.
- `lib/support-agent-queue.ts` writes assignment audit events with ticket ID, business ID, assigned agent, assigned by, reason, timestamp, and source.
- Support-agent queue payloads are scoped to assigned or authorized open tickets and mask contact fields for non-super-admin viewers.

Remaining risk:
- Live browser journeys for public customer handoff, signed-in customer handoff, support-agent accept/reply, and super-admin override still need manual verification.

## Security Headers

Status: warning

Evidence:
- `next.config.mjs` sets CSP, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, referrer policy, permissions policy, COOP, CORP, DNS prefetch, and HSTS in production.
- CSP allows required Cashfree, Google Maps, analytics, and Vercel endpoints.

Issue:
- `script-src` includes `'unsafe-inline'`; this is practical for current app constraints but should be reduced with nonces/hashes later.

## Fixes Implemented

- Removed sample Cashfree payout credentials from `.env.example`.
- Cleared the default WhatsApp business slug and added explicit routing guidance.
- Removed unsafe WhatsApp fallback to the latest verified business.
- Added tenant-aware authorization to non-public stored image routes.
- Added a production warning for ambiguous WhatsApp inbound routing.
- Added chatbot policy, guardrail, redaction, tool allowlist, provider fallback, audited handoff, and support assignment source logging.
- Added the top-level `npm test` release gate.
- Added clearer production env documentation/check output without allowing placeholders to pass.
- Added responsive audit DB preflight so signed-cookie browser checks use real users in the connected database.

## Remaining Risks

- Route-by-route dynamic IDOR and mass-assignment testing incomplete.
- Live Cashfree and WhatsApp verification incomplete.
- Production env check failing.
- Protected responsive audit cannot yet certify authenticated pages because the configured audit IDs are absent from the connected database.
- App/mobile account deletion readiness incomplete.

## Manual Verification Required

- Run all auth/RBAC tests against seeded users for owner, manager, kitchen staff, delivery staff, customer, support, and super admin.
- Verify Supabase privileges and RLS on the deployed database.
- Run Cashfree and WhatsApp signed callbacks from provider consoles.
- Review PII retention, bank details handling, audit logs, and privacy policy wording with legal/compliance counsel before launch.
