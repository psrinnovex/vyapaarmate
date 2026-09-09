# Bengaluru launch operations

VyapaarMate is configured to onboard and serve businesses in the Bengaluru launch market first. The policy is enforced on the server; the fixed city fields and Bengaluru-centred map are only user guidance.

## Current commercial policy

- Standard monthly list prices remain Starter at ₹1,499 and Pro at ₹2,999, before GST.
- While `NEXT_PUBLIC_BENGALURU_LAUNCH_OFFER` is enabled, an eligible Bengaluru business receives an automatic 80% subscription discount: Starter ₹299.80 or Pro ₹599.80, before GST.
- At the default 18% GST rate, the checkout totals are ₹353.76 and ₹707.76 respectively.
- The offer is applied again to a new manual 30-day checkout while the launch flag remains enabled. The owner must review the current total before every payment.
- Subscription coupons cannot be stacked with the launch offer.
- Setup work, payment-gateway charges, WhatsApp/provider usage, and GST are separate from the subscription discount.

## Eligibility controls

A business must use Bengaluru or Bangalore, Karnataka, and pin its operating location within 50 km of central Bengaluru. The same policy blocks out-of-market setup, billing checkout, KYC readiness, admin approval, public discovery, direct ordering, coupon preview, and WhatsApp commerce.

Registration records the launch city, but payment and KYC remain blocked until the owner completes setup with a valid address and map pin.

## Production flags

Set these in every deployment environment so the intended policy is explicit:

```bash
NEXT_PUBLIC_LAUNCH_MARKET=bengaluru
NEXT_PUBLIC_BENGALURU_LAUNCH_OFFER=true
SUBSCRIPTION_GST_RATE_BPS=1800
```

To end only the subscription promotion, set `NEXT_PUBLIC_BENGALURU_LAUNCH_OFFER=false` and redeploy. Historical invoices retain their recorded discount amounts and launch code.

For a future national rollout, setting `NEXT_PUBLIC_LAUNCH_MARKET=all` removes the Bengaluru-only onboarding and transaction restriction after redeploy. Public plan cards then show standard pricing; if the offer flag remains enabled, an eligible Bengaluru pin can still receive the regional promotion in checkout. Before expansion, replace the single-radius rule with versioned service-market boundaries, review existing business locations, and complete city-by-city onboarding and pricing QA.

## Launch checklist

1. Configure production database, app URL, email, Cashfree, Google Maps, rate limiting, and WhatsApp credentials using `docs/production-env-setup.md`.
2. Confirm the three flags above in Preview and Production.
3. Run `npm run db:deploy` against the production migration URL before deploying this application build. For a zero-downtime rollout, pause new subscription checkouts between the migration and application cutover, or repeat the migration's null-only identity backfill after cutover.
4. Register a new Starter and Pro business, complete a Bengaluru map pin, and verify checkout shows the list price, 80% discount, GST, and final total.
5. Confirm a pin outside the launch radius cannot pay, upload KYC, receive approval, appear publicly, or place an order.
6. Test email-code delivery, the contact/demo form, Cashfree sandbox payment and webhook activation, KYC approval, one public order, and one WhatsApp update.
7. Keep setup/provider charges in a separate written quote; do not describe them as included in the 80% subscription offer.
8. Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` before deployment.
