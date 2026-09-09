# Store Review Notes Template

Copy this into each console only after replacing every bracketed marker. Never commit passwords, OTPs, API keys, backup codes, or recovery tokens.

## Contact

- Review contact name: `[OWNER INPUT REQUIRED]`
- Review contact email: `[OWNER INPUT REQUIRED]`
- Review contact phone: `[OWNER INPUT REQUIRED]`
- Availability/time zone during review: `[OWNER INPUT REQUIRED]`

## App scope

VyapaarMate supports customer, owner, manager, kitchen-staff, and delivery-staff mobile accounts. Super-admin and support-agent tools are intentionally unavailable in the mobile app and remain on protected website/desktop surfaces. A mobile login attempt for either excluded role is rejected by the server.

The business app is a consumption-only companion for existing approved accounts. It does not sell, start, upgrade, or renew VyapaarMate software subscriptions and contains no external purchase call-to-action. Customer checkout covers only physical goods or services fulfilled outside the app and uses payment to the business at physical fulfilment. No card, bank, or UPI credential is entered in the native app.

## Primary business reviewer account

- Role: Owner
- Email: `[ENTER IN CONSOLE ONLY]`
- Password: `[ENTER IN CONSOLE ONLY]`
- Expected business: VyapaarMate Store Review Studio
- Expected state: approved, active, synthetic data, no live WhatsApp, no KYC/bank data, no real-money requirement
- Steps: `[VERIFY AND WRITE EXACT FINAL-BUILD STEPS]`

## Primary customer reviewer account

- Role: Customer
- Email: `[ENTER IN CONSOLE ONLY]`
- Password: `[ENTER IN CONSOLE ONLY]`
- Expected data: synthetic in-person appointment/order and status
- Steps: `[VERIFY AND WRITE EXACT FINAL-BUILD STEPS]`

## Account deletion test account

- Role: Customer
- Email: `[SEPARATE DISPOSABLE ACCOUNT — ENTER IN CONSOLE ONLY]`
- Password: `[ENTER IN CONSOLE ONLY]`
- Steps to deletion: `[VERIFY FINAL IN-APP STEPS]`
- External deletion resource: `https://www.vyapaarmate.com/account-deletion`
- Expected completion/retention copy: `[PASTE EXACT FINAL UI COPY]`

If staff self-deletion is part of the submitted binary, add a separate disposable staff credential and exact steps. Do not tell review to delete the primary owner or customer credential.

## Payments and integrations

- The synthetic appointment uses Cash/Pay Later and does not require a real payment.
- Cashfree is not exposed by the submitted native v1 binary. Website payment configuration is outside the reviewer journey.
- No Meta Business account is required. The review tenant has live WhatsApp disabled.
- No real KYC document, UPI ID, bank account, payout beneficiary, or live customer information is present.

## Backend and special configuration

- Production API base URL: `[OWNER/RELEASE INPUT REQUIRED]`
- Build/version reviewed: `[OWNER/RELEASE INPUT REQUIRED]`
- Feature flags needed by review: `[NONE, OR LIST EXACT VERIFIED FLAGS]`
- Hardware/permission notes: `[VERIFY IN FINAL BUILD]`
- Any non-obvious navigation: `[VERIFY IN FINAL BUILD]`

## Pre-submission verification

- Credentials tested on clean iPhone and Android installations.
- Backend remains live and monitored throughout review.
- Review accounts do not expire, require an inaccessible OTP, or depend on a private network.
- Deletion-test account can be reseeded without changing primary credentials.
- Notes match the exact submitted binary and do not describe web-only features as mobile features.
