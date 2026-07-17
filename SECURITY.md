# VyapaarMate Security Checklist

## Implemented in This MVP

- Role-based access control for `SUPER_ADMIN`, `OWNER`, `MANAGER`, `KITCHEN_STAFF`, and `DELIVERY_STAFF`.
- Tenant isolation helpers that enforce `businessId` access boundaries.
- Secure JWT session cookie structure.
- bcrypt password hashing.
- Zod validation for auth and order submission.
- Redis-backed distributed rate limiting for production, with in-memory fallback for local development.
- Cross-origin blocking for unsafe API requests that use browser cookies.
- Prisma ORM for SQL injection protection.
- Cashfree webhook signature verification using raw request bodies.
- WhatsApp webhook verification token and signed payload verification.
- Separate customer consent for WhatsApp order updates and marketing offers.
- Audit log helper for important actions.
- Environment-based secrets with no hardcoded API keys.
- AES-GCM helper for encrypting provider secrets before persistence.
- Secure headers configured in `next.config.mjs`.
- Next 16 proxy protection for `/dashboard`, `/admin`, `/user`, and unsafe `/api` requests.
- Supabase generated Data API table grants revoked for `anon`, `authenticated`, and `service_role` roles unless a future migration grants a narrow API surface intentionally.
- npm audit currently reports zero vulnerabilities at moderate level and above.

## Required Before Production

- Set `DEMO_SEED_PASSWORD` to a unique local-only value before seeding; never commit or reuse it for production.
- Rotate any account that ever used the historical committed demo password.
- Set strong `JWT_SECRET` and `ENCRYPTION_KEY`.
- Use HTTPS everywhere.
- Configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`; keep `RATE_LIMIT_FAIL_OPEN=false`.
- Disable Supabase Data API in the Supabase dashboard unless a dedicated API schema is intentionally exposed.
- Add webhook event persistence/idempotency tables if provider dispute investigation needs raw event replay.
- Keep WhatsApp Cloud API templates approved before enabling live sends.
- Add storage provider signed uploads with content type and size checks.
- Add KYC/business verification workflow before enabling live payments.
- Add data retention and deletion workflows for customer privacy requests.
- Add platform admin audit log views backed by database queries.
- Add production monitoring, alerting, backup, and restore runbooks.
- Restrict `TRUSTED_ORIGINS` to final HTTPS app origins only if extra first-party origins are required.
- Rotate provider secrets regularly and store encrypted values only.
