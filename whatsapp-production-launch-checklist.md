# WhatsApp Production Launch Checklist

Use this checklist for the VyapaarMate production WhatsApp Cloud API launch. Complete every required gate before enabling live messages for a business.

## Security rules

- [ ] Never commit Meta access tokens, app secrets, webhook verify tokens, database credentials, encryption keys, or Vercel tokens to GitHub.
- [ ] Never paste production secrets into support tickets, chat messages, screenshots, investor material, logs, or browser recordings.
- [ ] Store server secrets only in Vercel Production Environment Variables or in VyapaarMate's encrypted per-business credential fields.
- [ ] Use a dedicated Meta system user with only the assets and permissions required for the production WABA.
- [ ] Rotate any token or secret that may have been exposed.
- [ ] Keep `WHATSAPP_LIVE_SENDS_ENABLED=false` unless the global fallback Meta credentials are deliberately being used. Per-business live sends are controlled by the encrypted business credentials and PSHR approval fields.
- [ ] Do not approve WhatsApp for a business until the Meta connection test succeeds.

## Current production target

- Application origin: `https://www.vyapaarmate.com`
- Meta callback URL: `https://www.vyapaarmate.com/api/webhooks/whatsapp`
- Production branch: `main`
- Runtime: Vercel Next.js production deployment
- Database: production PostgreSQL/Supabase project configured for the Vercel production environment

## 1. Business and subscription readiness

For **PSHR Saloon & Spa**:

- [ ] Confirm the correct business record and slug before changing any status.
- [ ] Reactivate the intended subscription plan.
- [ ] Set the subscription status to `ACTIVE` only after the corresponding payment or approved manual activation is recorded.
- [ ] Confirm the subscription start date, end date, invoice/payment state, and plan are internally consistent.
- [ ] Confirm the business is active and verified.
- [ ] Confirm its catalog/services, booking settings, business hours, service area, and customer-facing phone number are correct.
- [ ] Confirm the business owner has consented to connect the production WhatsApp number.

Evidence to retain:

- Business ID and slug
- Subscription ID
- Plan and activation date
- Payment or approved manual-activation reference
- Admin user who performed the change
- Audit-log entry

## 2. Generate and collect Meta values

Collect the following values directly from the production Meta app and WhatsApp Manager:

- [ ] Production display phone number in international/E.164 format
- [ ] WhatsApp Phone Number ID
- [ ] WhatsApp Business Account ID (WABA ID)
- [ ] Permanent system-user access token
- [ ] Meta App Secret

Verify before use:

- [ ] The app belongs to the correct PSHR Innovex Meta Business portfolio.
- [ ] The WABA is the intended production WABA.
- [ ] The phone number is registered to that WABA and is not a Meta test number.
- [ ] The system user is assigned only the intended app/WABA assets.
- [ ] The token has the minimum required WhatsApp permissions and has not expired.
- [ ] Two-factor authentication and appropriate admin controls are enabled on the Meta Business account.

Do not record secret values in this checklist.

## 3. Create the webhook verify token

- [ ] Generate a new random token of at least 32 characters using a cryptographically secure generator.
- [ ] Do not reuse a password, API token, JWT secret, encryption key, or local-development token.
- [ ] Store the same token in Vercel as `WHATSAPP_WEBHOOK_VERIFY_TOKEN` and enter it in Meta during callback verification.
- [ ] Keep the value server-only.

Example generation command on a trusted machine:

```bash
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))"
```

## 4. Configure Vercel Production environment variables

Open the VyapaarMate Vercel project and add/update these variables for the **Production** environment:

Required for webhook security:

- [ ] `WHATSAPP_APP_SECRET` = Meta production app secret
- [ ] `WHATSAPP_WEBHOOK_VERIFY_TOKEN` = newly generated production verify token
- [ ] `WHATSAPP_GRAPH_API_VERSION` = the Graph API version validated for this release

Global fallback credentials, only when deliberately required:

- [ ] `WHATSAPP_ACCESS_TOKEN`
- [ ] `WHATSAPP_PHONE_NUMBER_ID`
- [ ] `WHATSAPP_LIVE_SENDS_ENABLED=true`

Recommended multi-business mode:

- [ ] Keep global fallback live sends disabled.
- [ ] Store the production Phone Number ID, WABA ID, and permanent token through Admin -> WhatsApp Setup for the specific business.
- [ ] Confirm `ENCRYPTION_KEY` is present and unchanged before saving per-business tokens.

Validation:

- [ ] Secret values do not use the `NEXT_PUBLIC_` prefix.
- [ ] Variables are scoped to Production, not accidentally exposed to Preview or Development.
- [ ] No placeholder values such as `local-dev-only`, `your-token`, or `changeme` remain.
- [ ] Save the variables and create a new production deployment. Existing deployments do not receive newly added environment variables.

## 5. Configure the Meta webhook callback

In the production Meta app:

- [ ] Open WhatsApp -> Configuration/Webhooks.
- [ ] Set callback URL to exactly:

```text
https://www.vyapaarmate.com/api/webhooks/whatsapp
```

- [ ] Enter the same value stored in `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
- [ ] Complete callback verification successfully.
- [ ] Subscribe the WhatsApp webhook to the `messages` field.
- [ ] Confirm the production WABA is subscribed to the app.
- [ ] Confirm the subscription applies to the intended production WABA, not only the test WABA.

Expected verification behavior:

- Correct mode/token returns Meta's challenge with HTTP 200.
- Incorrect verify token returns HTTP 403.

## 6. Configure the business in VyapaarMate Admin

Go to **Admin -> WhatsApp Setup** for **PSHR Saloon & Spa** and enter:

- [ ] Production display number
- [ ] Phone Number ID
- [ ] WABA ID
- [ ] Permanent system-user token

Before saving:

- [ ] Reconfirm all IDs belong to the same Meta app/WABA/phone-number combination.
- [ ] Confirm the token is not a temporary developer token.
- [ ] Confirm the display number matches the business's intended customer-facing WhatsApp number.
- [ ] Confirm no leading/trailing spaces were copied into IDs or token fields.

After saving:

- [ ] Confirm the access token is stored encrypted and is not returned to the browser or logs in plaintext.
- [ ] Confirm the business status shows configured/pending approval rather than live before the test.
- [ ] Run the Meta connection test.
- [ ] Review the exact Meta error if the test fails; do not repeatedly rotate or replace unrelated credentials.
- [ ] Select **Approve WhatsApp** only after the connection test succeeds.
- [ ] Confirm the business changes to the expected live status.

## 7. Code and deployment gates

Before merging/deploying a WhatsApp production change:

- [ ] Webhook GET verification is implemented.
- [ ] Webhook POST requests verify `x-hub-signature-256` with the Meta app secret.
- [ ] Invalid or missing production signatures are rejected.
- [ ] Inbound routing prioritizes Meta Phone Number ID and does not route one business's messages to another tenant.
- [ ] Per-business access tokens remain encrypted at rest.
- [ ] Interactive-list payloads respect Meta's section/row limits.
- [ ] The same inbound Meta message ID cannot create duplicate replies, carts, bookings, orders, or payment requests.
- [ ] Logs redact tokens, secrets, phone-sensitive data, and raw payloads where not required.
- [ ] Production environment validation passes.
- [ ] Database migrations are applied successfully before promotion.
- [ ] Lint, typecheck, tests, security audit, and production build pass.

Recommended commands on a trusted checkout with production-safe values:

```bash
npm ci
npm run production:check
npm run lint
npm run typecheck
npm test
npm audit --audit-level=moderate
npm run build
```

Do not run the destructive demo seed against production.

## 8. Deploy

- [ ] Merge only the reviewed production branch/PR into `main`.
- [ ] Confirm Vercel starts a Production deployment from the intended commit.
- [ ] Confirm the production database migration gate passes.
- [ ] Confirm the final deployment uses `https://www.vyapaarmate.com`.
- [ ] Confirm the deployment has the newly saved WhatsApp environment variables.
- [ ] Record the Git commit SHA and Vercel deployment ID.

## 9. Production smoke tests

Use a controlled test customer number that is permitted to message the production business number.

Webhook security:

- [ ] Correct Meta verification succeeds.
- [ ] Invalid verification token is rejected.
- [ ] POST without a valid Meta signature is rejected.

Inbound conversation:

- [ ] Send `hi` or `menu` to the production display number.
- [ ] Receive exactly one VyapaarMate reply.
- [ ] Confirm the reply is for PSHR Saloon & Spa, not another tenant.
- [ ] Confirm the service list contains no more than Meta's allowed rows per list.
- [ ] Select a service.
- [ ] Send the requested date/time and verify a booking request is created.
- [ ] Confirm the owner/admin dashboard receives the correct customer, business, and booking data.

Idempotency:

- [ ] Replay the same signed webhook payload/message ID in a controlled test.
- [ ] Confirm no duplicate reply, order, booking, payment request, or customer action is created.

Outbound messaging:

- [ ] Send a valid message inside the customer-service window.
- [ ] Send one approved template outside the customer-service window where applicable.
- [ ] Confirm Meta returns a message ID.
- [ ] Confirm sent/delivered/read/failed callbacks update the correct WhatsApp message record.
- [ ] Confirm failed sends show a safe operational error without exposing credentials.

## 10. Monitoring and evidence

Capture non-secret evidence for the launch record:

- [ ] Git commit SHA
- [ ] Vercel production deployment ID
- [ ] Deployment/build result
- [ ] Migration result
- [ ] Meta callback verification success
- [ ] WABA `messages` subscription confirmation
- [ ] Admin connection-test success
- [ ] Business WhatsApp live status
- [ ] One successful inbound test message ID, partially redacted
- [ ] One successful outbound Meta message ID, partially redacted
- [ ] Delivery-status callback result
- [ ] No-duplicate replay result
- [ ] Subscription reactivation audit reference

Never include the app secret, verify token, permanent access token, full customer phone numbers, or raw signed webhook body in launch evidence.

## 11. Rollback and incident response

If messages route incorrectly, duplicate actions occur, or credentials are suspected to be exposed:

- [ ] Disable WhatsApp live approval for the affected business immediately.
- [ ] Disable global live sends if global fallback credentials are active.
- [ ] Revoke/rotate the affected Meta system-user token.
- [ ] Rotate `WHATSAPP_APP_SECRET` when required by the incident.
- [ ] Rotate `WHATSAPP_WEBHOOK_VERIFY_TOKEN` and reverify the Meta callback when required.
- [ ] Redeploy after changing Vercel environment variables.
- [ ] Preserve redacted audit logs and affected Meta message IDs.
- [ ] Check for duplicate orders/bookings/payments before re-enabling the integration.
- [ ] Re-run the complete smoke-test section before approving the business again.

## Final launch approval

Launch is approved only when all of the following are true:

- [ ] PSHR Saloon & Spa subscription is active and auditable.
- [ ] Meta callback verification succeeds.
- [ ] The app/WABA is subscribed to `messages`.
- [ ] Production Meta credentials are stored in the correct secure locations.
- [ ] Admin connection testing succeeds.
- [ ] PSHR WhatsApp approval is enabled for the correct business.
- [ ] Production deployment is healthy.
- [ ] Inbound and outbound smoke tests pass.
- [ ] Duplicate webhook delivery does not duplicate business actions.
- [ ] Rollback steps and launch evidence are recorded.
