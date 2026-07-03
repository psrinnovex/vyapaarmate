# Backend, Database, And API Audit

Date: 2026-07-03  
Overall status: warning - backend foundation is good, but full route-level dynamic verification remains incomplete

## Summary

The backend has strong patterns: server-side Prisma access, DB-backed session revalidation, RBAC helpers, cron secret checks, webhook signature checks, safe logging, production env checks, and Supabase Data API lock-down. The top-level test gate and targeted backend tests pass. The release blocker is not build quality; it is incomplete route-by-route dynamic verification, missing production configuration, and unverified live provider/database behavior.

## Files Reviewed

- `app/api/**/route.ts`
- `lib/api-session.ts`, `lib/rbac.ts`, `lib/security/*`
- `services/business-wallet.ts`, `services/cashfree.ts`, `services/online-payments.ts`, `services/payment-reconciliation.ts`, `services/whatsapp-commerce.ts`
- `prisma/schema.prisma`
- `supabase/migrations/*`
- `scripts/check-production-env.mjs`
- `scripts/qa/responsive-audit.mjs`

## API Inventory

Auth APIs:
- `/api/auth/login`, `/api/auth/logout`, `/api/auth/register`, `/api/auth/register/resend`, `/api/auth/register/verify`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/change-password`, `/api/auth/session`, `/api/auth/user-register`

Business/dashboard APIs:
- `/api/businesses`, `/api/business-service-types`, `/api/dashboard/overview`, `/api/dashboard/setup`, `/api/dashboard/settings`, `/api/dashboard/menu`, `/api/dashboard/menu/[itemId]`, `/api/dashboard/menu/categories`, `/api/dashboard/orders/[orderId]`, `/api/dashboard/customers/[customerId]`, `/api/dashboard/staff`, `/api/dashboard/coupons`, `/api/dashboard/kyc/documents`, `/api/dashboard/live`

Order/storefront APIs:
- `/api/orders`, `/api/orders/[publicToken]`, `/api/orders/[publicToken]/cashfree-checkout`, `/api/orders/[publicToken]/invoice`, `/api/orders/[publicToken]/payment`, `/api/orders/coupon`

Payment/billing/subscription APIs:
- `/api/dashboard/billing/*`, `/api/dashboard/payments/[paymentId]`, `/api/admin/payments/*`, `/api/admin/subscriptions/*`, `/api/admin/payment-settings`

Admin APIs:
- `/api/admin/businesses`, `/api/admin/businesses/[businessId]`, `/api/admin/businesses/[businessId]/kyc/documents/[documentId]`, `/api/admin/businesses/[businessId]/payouts`, `/api/admin/business-coupons`, `/api/admin/subscription-coupons`, `/api/admin/live`, `/api/admin/support/*`

Support APIs:
- `/api/support/chat/[ticketId]`, `/api/support/chat/[ticketId]/feedback`

Intelligence/AI APIs:
- `/api/intelligence/summary`, `/api/intelligence/recommendations`, `/api/intelligence/customers-at-risk`, `/api/intelligence/revenue-opportunities`, `/api/intelligence/accuracy`, `/api/intelligence/data-sources`, `/api/intelligence/model-status`, `/api/intelligence/predictions`, `/api/intelligence/train`

Webhook APIs:
- `/api/webhooks/cashfree`, `/api/webhooks/cashfree-payouts`, `/api/webhooks/whatsapp`

Job APIs:
- `/api/jobs/automatic-payouts`, `/api/jobs/intelligence-refresh`, `/api/jobs/payment-reconciliation`, `/api/jobs/payment-reminders`, `/api/jobs/payment-transfers`

Image/upload APIs:
- `/api/business-images/[businessId]`, `/api/menu-images/[itemId]`, `/api/dashboard/kyc/documents`

## Verification Results

| Check | Status | Evidence |
| --- | --- | --- |
| Build route manifest | pass | `npm run build` exited 0 and listed all app/API routes. |
| TypeScript | pass | `npx tsc --noEmit` exited 0. |
| Lint | pass | `npm run lint` exited 0. |
| Top-level test command | pass | `npm test` runs the existing security, payment/business, chatbot, business-intelligence, and real AI/ML suites. |
| Security tests | pass | `npm run test:security`: 5 tests passed. |
| Payment/business tests | pass | `npm run test:payments`: 41 tests passed. |
| Chatbot/support tests | pass | `npm run test:chatbot`: 21 tests passed. |
| Business intelligence tests | pass | `node --import tsx --test lib/business-intelligence.test.ts`: 11 tests passed. |
| Real AI/ML tests | pass | `node --import tsx --test lib/intelligence/ml/real-ai-intelligence.test.ts`: 7 tests passed. |
| Raw SQL search | pass | No matches for raw Prisma SQL helpers in app/lib/services/scripts/prisma/supabase. |
| Production env check | fail | Missing Upstash Redis and Google Maps/Places API keys; output now points to `docs/production-env-setup.md`. |
| Protected responsive API/session browser test | fail/setup-blocked | Audit preflight rejects configured audit IDs because they do not exist in the connected database. |

## Backend Area Status

| Area | Status | Notes |
| --- | --- | --- |
| Auth APIs | warning | Rate-limited auth routes exist; full browser and malformed payload testing incomplete. |
| Business APIs | warning | Server-derived business session patterns reviewed; all mutation routes need dynamic IDOR tests. |
| Dashboard APIs | warning | Routes exist and build; protected browser audit did not certify them. |
| Order APIs | warning | Order/payment tests cover core rules; full storefront checkout not executed. |
| Payment APIs | warning | Cashfree tests pass; live/sandbox provider verification not executed. |
| Billing/subscription APIs | warning | Routes exist and build; full subscription checkout not executed. |
| Admin APIs | warning | Admin routes exist and build; route-level authorization fuzzing incomplete. |
| Support APIs | warning | Chatbot tests pass; live support queue and ticket flow not executed. |
| Staff APIs | warning | RBAC model exists; staff-role dynamic testing incomplete. |
| Coupon APIs | warning | Routes exist and build; cross-tenant coupon tests not executed. |
| KYC APIs | warning | KYC document routes exist; storage/retention/encryption review needs production confirmation. |
| Intelligence APIs | warning | Tests pass for rules/ML governance; per-business trained artifact availability must be verified. |
| Webhook APIs | warning | Signature checks reviewed; real provider callback tests not run. |
| Job APIs | pass with manual verification | `requireCronRequest()` protects job routes; production cron integration still needs verification. |
| Image APIs | pass for implemented fix | Non-public business/menu images now require authorized access and private cache. |

## Database And Supabase

Status: warning

Evidence:
- `prisma/schema.prisma` reviewed for tenant models, indexes, cascade behavior, payments, subscriptions, WhatsApp, support, and intelligence tables.
- `supabase/migrations/20260623160000_lock_down_supabase_data_api.sql` revokes public/API role table/sequence/function access and enables RLS on all public tables.
- AI/intelligence migrations include RLS and access-control policy scaffolding.

Risks:
- No live migration dry-run or deployed Supabase policy verification was executed.
- Cascading deletes from `Business` are broad and must remain admin-only with audit logging.
- Payout/bank details and KYC document storage require production encryption, retention, and access-review policy.

## Issues Found

- `production:check` fails on missing Redis and Google API configuration.
- Full API route/method/role/tenant dynamic tests are not complete.
- Protected route responsive/session browser audit is blocked until local audit users/business are seeded into the same database as the dev server.
- Live Supabase/RLS verification was not executed.

## Fixes Implemented

- Added authorization and private caching for non-public business images.
- Added authorization and private caching for non-public menu images.
- Removed unsafe WhatsApp tenant fallback.
- Removed sample payout credentials from `.env.example`.
- Added production env warning for ambiguous WhatsApp routing.
- Added the top-level `npm test` release gate.
- Added production env setup documentation and clearer `production:check` failures without weakening the gate.
- Added responsive audit database preflight validation for real app session revalidation.

## Remaining Risks

- No exhaustive API test suite for every route/method/role/tenant combination.
- Production service configuration incomplete.
- Live DB/RLS verification incomplete.
- Provider integrations need sandbox/live callback validation.

## Manual Verification Required

- Seed owner, manager, kitchen, delivery, customer, support, and super admin users.
- Run CRUD and forbidden-access tests for every sensitive API route.
- Run Prisma migrations against a staging Supabase database and verify `anon`/`authenticated` cannot read tables directly.
- Run Cashfree payment, payout, failure, and reconciliation flows in sandbox.
- Run WhatsApp signed webhook and commerce reply flow using a Meta test number.
