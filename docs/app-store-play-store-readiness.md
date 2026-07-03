# App Store And Play Store Readiness

Date: 2026-07-02  
Overall status: fail for mobile store submission today; warning for PWA foundation

## Evidence And Files Reviewed

Evidence:
- Route/build manifest confirms `/privacy`, `/terms`, `/contact`, and `/manifest.webmanifest`.
- Static review found no native mobile package or app-store metadata.
- Protected responsive audit failed to certify signed-in mobile layouts.
- `production:check` fails on missing production service configuration.

Files reviewed:
- `app/privacy/page.tsx`
- `app/terms/page.tsx`
- `app/contact/page.tsx`
- `app/manifest.ts`
- `next.config.mjs`
- `components/layout/public-footer.tsx`
- `components/contact/contact-page.tsx`
- `components/dashboard/dashboard-shell.tsx`
- `scripts/qa/responsive-audit.mjs`

Issues found:
- No account deletion UI or authenticated deletion screen.
- No reviewer test-account package.
- No native app package/signing metadata.
- Payment/subscription store-policy review not complete.
- Signed-in responsive mobile layouts not certified.

Fixes implemented:
- Added this readiness report with explicit store blockers and required fixes.
- No mobile packaging code was changed in this pass.

## 1. Google Play Readiness

Status: fail

What is present:
- Public privacy page: `/privacy`
- Public terms page: `/terms`
- Support/contact page: `/contact`
- PWA manifest: `/manifest.webmanifest`
- Mobile-responsive code patterns exist in shared UI and shell components.

Blocking gaps:
- No native Android package or store listing metadata verified.
- No in-app account deletion flow or clear authenticated deletion screen.
- No reviewer test account package documented.
- Protected responsive audit failed because authenticated Chrome session redirected to login.
- Production env check fails.
- Payment/subscription policy review not completed.

## 2. Apple App Store Readiness

Status: fail

What is present:
- Privacy, terms, contact/support pages.
- Web/PWA app surface that could be packaged later.
- Minimal browser permissions in headers.

Blocking gaps:
- No iOS app package, signing, bundle ID, App Store Connect metadata, screenshots, or review notes verified.
- Account deletion must be easy to find inside the app if account creation exists.
- In-app purchase policy risk must be reviewed if mobile packaging sells digital subscriptions.
- Signed-in reviewer flow not verified.

## 3. Required Screenshots/Pages

Needed before submission:
- Login/register
- Business setup
- Owner dashboard overview
- Orders
- Menu/catalog
- Payments
- Customers
- Admin support or support portal, if exposed to reviewers
- Storefront `/b/[slug]`
- Cart/checkout/order status
- Privacy policy
- Terms
- Account deletion screen or instructions inside authenticated settings

## 4. Test Account Requirements

Status: not ready

Needed:
- Owner test account with active verified business and sample catalog.
- Customer test account if customer portal is included.
- Support test account if support portal is reviewable.
- Admin test account only if the store review team must access admin flows; otherwise do not expose admin credentials.
- Sandbox payment instructions that do not require real money.
- WhatsApp flow evidence or a fallback demo mode that does not require reviewer access to a Meta business account.

## 5. Privacy/Data-Safety Items

Status: warning

Data categories likely used:
- Name, email, phone, address
- Business profile and catalog data
- Orders, payments, invoices, subscriptions
- Support tickets and chat messages
- WhatsApp message metadata
- KYC/payout data for businesses
- Analytics if configured

Required before submission:
- Final privacy policy review.
- Data retention and deletion procedure.
- Data export/deletion contact and in-app flow.
- Disclosure for payment processors and WhatsApp/Meta.
- Clarify whether analytics, crash reporting, or advertising identifiers are used.

## 6. Permission Usage

Status: warning

Evidence:
- `next.config.mjs` sets `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`.
- No camera or microphone need was found.
- Google Maps/location search is present, so geolocation/location disclosure may be needed if packaged.

Recommendation:
- Keep camera and microphone disabled.
- Request location only when a user chooses address/location features.
- Document Maps/Places usage in privacy and data-safety forms.

## 7. Payment/Subscription Risks

Status: warning

Risks:
- Physical goods/services orders can generally use external payment providers, but mobile store rules must be reviewed carefully.
- SaaS subscription purchase inside a mobile app may trigger Apple/Google in-app purchase requirements depending on what is sold and where it is consumed.
- Cashfree checkout, UPI, payouts, invoices, refunds, and subscription disclosure need reviewer-friendly copy and sandbox behavior.

## 8. Rejection Risks

- Missing account deletion flow.
- Reviewer cannot log in or complete signed-in flows.
- Payment/subscription policy conflict.
- Broken protected mobile layouts.
- Incomplete privacy/data-safety declarations.
- Hidden admin/support functionality without explanation.
- Placeholder/demo credentials or secrets in app/config.
- WhatsApp or payment flows requiring external approvals not available to reviewers.

## 9. Fixes Needed Before Submission

- Add an authenticated account deletion flow or a clear in-app deletion request screen.
- Prepare reviewer test accounts and sandbox payment steps.
- Fix protected responsive audit and capture screenshots at phone/tablet sizes.
- Complete production env configuration and rerun `production:check`.
- Prepare Play Console and App Store Connect metadata, support URL, privacy URL, screenshots, and review notes.
- Review mobile payment/subscription rules before packaging subscriptions.
- Remove any demo credentials from visible production UI and documentation.

## Remaining Risks

- Store policy interpretation may differ depending on whether subscriptions are sold inside a packaged app.
- Reviewer access can fail if seeded users, sandbox payments, or WhatsApp test flows are not stable.
- Privacy/data-safety declarations may be incomplete without a final data inventory and retention policy.
- Protected mobile layouts are still uncertified.

## Manual Verification Required

- Test packaged Android/iOS builds when they exist.
- Walk through reviewer accounts on a clean device.
- Confirm account deletion from inside the signed-in app.
- Verify payment/subscription policy with Apple and Google guidance before submission.
- Capture final phone, tablet, and large-screen screenshots after responsive audit passes.
