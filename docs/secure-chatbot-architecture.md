# Secure Chatbot Architecture

Date: 2026-07-03  
Status: implemented baseline, rules-based chatbot, external AI provider disabled by default

## Current Entry Points

- Public chatbot: `POST /api/chatbot` from `components/support/site-chatbot.tsx`.
- Authenticated customer chat: same `/api/chatbot` endpoint with a verified `CUSTOMER` session; live ticket messages use `/api/support/chat/[ticketId]`.
- Owner/manager/staff chatbot: same `/api/chatbot` endpoint with verified business roles and server-derived `businessId`.
- Support/admin live-agent routes: `/api/admin/support`, `/api/admin/support/[ticketId]`, `/api/admin/support/[ticketId]/messages`, `/api/support/chat/[ticketId]`.
- WhatsApp commerce: `/api/webhooks/whatsapp` resolves tenant from Meta phone identifiers or explicit map/default; it does not currently route WhatsApp text into the chatbot.

## Current Bot State

The chatbot is rules-based. There is no OpenAI/LLM provider call in the support bot path. `AI_PROVIDER_ENABLED=false` is the default. Future provider use must go through tenant-scoped context, redaction, tool allowlists, and explicit production documentation.

## Chatbot Modes

- `PUBLIC_INFO`: public users; public product, pricing, demo, storefront, and order-help guidance only.
- `CUSTOMER_AUTH`: signed-in customers; customer-safe guidance and own-order tool access only.
- `BUSINESS_OWNER`: owner, manager, and staff sessions; business guidance scoped to server-derived `businessId` and role permissions.
- `SUPPORT_AGENT`: support agents; assigned tickets and authorized open queue only.
- `SUPER_ADMIN`: platform support/admin context through existing super-admin authorization.

## Data Access Rules

Allowed server tools are in `lib/chatbot/chatbot-tools.ts`:

- `getPublicBusinessInfo(slug)`
- `getCustomerOwnOrderStatus(orderPublicToken | orderNumber)`
- `getBusinessOwnerSummary(businessId)` after server-side business access checks
- `getAssignedSupportTickets()` for super admin or assigned/open authorized support scope
- Support ticket/message/handoff flows through existing server routes

Blocked from chatbot tools:

- list all businesses, customers, payments, support tickets
- raw log access
- secrets, tokens, API keys, database details
- KYC documents
- payout bank data
- export-data actions

## Guardrails

`lib/chatbot/chatbot-guardrails.ts` blocks prompt-injection, system-prompt, secret, cross-tenant, bulk PII export, internal-log/schema, payment/KYC/bank, and privileged-action requests. Unsafe requests get short refusals and are audit logged.

The chatbot never directly performs refunds, order-status changes, support assignment, ticket closure, WhatsApp sends, email sends, billing changes, KYC/payout access, or admin-log access.

## Tenant Isolation

All private context is resolved from `getSessionUser()` and database lookups. Client-provided `businessId`, `userId`, `ticketId`, `orderId`, and `customerId` are not trusted for authorization. Business tools call `canAccessBusiness()` or role-specific checks before reading data.

## Redaction And Retention

`lib/chatbot/chatbot-redaction.ts` masks email, phone, bearer tokens, JWTs, card-like numbers, UPI IDs, IFSC-like references, OTP/CVV/password/API-key style values, and nested metadata.

Defaults:

- `CHATBOT_STORE_RAW_MESSAGES=false`
- `CHATBOT_TRANSCRIPT_RETENTION_DAYS=30`

Raw transcript storage is opt-in and should require privacy/legal approval.

## Rate Limits And Fallbacks

The chatbot applies per-IP, per-session/user, handoff, and per-ticket message rate limits. Redis-backed shared limits are used when Upstash is configured; production must keep `RATE_LIMIT_FAIL_OPEN=false`.

If a future provider fails, the bot must fall back to rules-based support and not retry tool loops indefinitely. Current provider config is disabled by default.

## Remaining Manual Verification

- Run live customer/owner/support/super-admin handoff journeys against seeded users.
- Verify production Redis rate limits across serverless instances.
- Verify deployed Supabase privileges/RLS separately from Prisma server access.
- Review raw transcript retention and privacy policy wording before enabling raw storage.
