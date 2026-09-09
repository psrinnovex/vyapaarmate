# Native Store Release Checklist

Submission status must remain `BLOCKED` until every P0 item is checked with evidence.

## P0 — product and policy

- [ ] Final native role allowlist is customer, owner, manager, kitchen staff, and delivery staff.
- [ ] Super admin and support agent are rejected at mobile credential issuance and every mobile API boundary.
- [ ] Customer, staff, and business-owner deletion can be initiated in the app.
- [ ] `https://www.vyapaarmate.com/account-deletion` works while logged out, uses a verified request flow, is prominently branded, and does not reveal account existence.
- [ ] Deletion revokes mobile/browser sessions and deletes or anonymizes personal fields not covered by a documented retention requirement.
- [ ] Every retained category has an owner/counsel-approved purpose and period; processor deletion/retention handling is documented.
- [ ] `ACCOUNT_RETENTION_POLICY_APPROVED_VERSION` exactly matches the approved notice; the super-admin retention queue, annual-review evidence, time-limited legal holds, and due final purge are tested.
- [ ] Business deletion disables storefront, new commerce, subscription access, live messaging/integrations, and active sessions immediately, with visible request status/timing.
- [ ] Native business registration, subscription prices, start/upgrade/renew checkout, coupons, `/pricing`, payment links, and external purchase calls-to-action are absent.
- [ ] Mobile-audience tokens are rejected by server-side business-subscription checkout routes.
- [ ] Cashfree or other external payment is limited to physical goods/services fulfilled outside the app; no digital functionality can be unlocked.
- [ ] `/mobile/privacy` and `/mobile/terms` are deployed, accurate, counsel/owner approved, and contain no commerce navigation.
- [ ] Designated privacy contact and registered address are provided by the owner and published where legally/store-required.

## P0 — binary and security

- [ ] Bundle/application IDs are owner-approved and match signing and console records.
- [ ] Release version/build numbers are deterministic and match uploaded artifacts.
- [ ] Access tokens are short-lived and audience-bound; rotating refresh credentials are stored only in Keychain/Keystore and server-hashed.
- [ ] Password reset/deletion/global sign-out revoke mobile sessions.
- [ ] The fixed custom-scheme PKCE auth return is present in both native manifests, state-validated, and rejects every other redirect. No universal/app/payment-return link is claimed for v1.
- [ ] iOS privacy manifest and required-reason API report are clean.
- [ ] Android merged manifest contains only justified permissions; sensitive permission declarations are complete if applicable.
- [ ] Secrets, test passwords, provider credentials, bank details, and KYC data are absent from source and binary.
- [ ] Dependency/SBOM and vulnerability/license review is archived.

## P0 — review and devices

- [ ] `scripts/seed-store-review.mjs` ran against the exact confirmed target; output and fixture IDs are archived without secrets.
- [ ] Primary owner/customer and disposable deletion accounts work without private network access or inaccessible OTP.
- [ ] All reviewer steps were repeated on clean physical iPhone and Android devices using release builds.
- [ ] Customer browse/order/appointment/status and business operational journeys pass on slow/offline/retry conditions.
- [ ] Account deletion, token revocation, reinstall, password reset, and post-deletion login denial pass on both platforms.
- [ ] Cash-at-physical-fulfilment order and appointment behavior passes; the v1 native binary contains no online-payment return flow and no real reviewer payment is required.
- [ ] Reviewer accounts remain monitored and non-expiring throughout review.

## App Store Connect

- [ ] Legal entity, agreements, tax/banking, trader status, app record, bundle ID, SKU, and users/roles are owner-verified.
- [ ] Listing text describes only final mobile features.
- [ ] Support, privacy, and deletion URLs return production content.
- [ ] Final icon and genuine screenshots meet current specifications.
- [ ] Age rating, content rights, export compliance, App Privacy, availability, review contact, credentials, and notes are complete.
- [ ] Uploaded archive is inspected for bundle ID, version/build, signing team, entitlements, architectures, privacy manifests, and embedded SDKs.
- [ ] TestFlight release passes clean-device smoke and deletion tests.

## Google Play Console

- [ ] Verified organization/developer profile and app record are owner-confirmed.
- [ ] Listing text, support contact, privacy URL, deletion URL, icon, feature graphic, and screenshots are final.
- [ ] App access, ads, target audience, IARC/content rating, Data Safety, Financial Features, and all current App content declarations are complete.
- [ ] Uploaded AAB is inspected for application ID, version code/name, signer, min/target SDK, permissions, native libraries, and embedded SDKs.
- [ ] Internal and closed testing pass clean-device smoke and deletion tests before production rollout.

## Submission authority

- [ ] Authorized owner approves final metadata, declarations, countries, legal text, screenshots, reviewer credentials, build IDs, and release timing.
- [ ] Console changes are exported/screenshotted before submission.
- [ ] The exact binary under review is immutable; no unverified remote configuration changes its declared behavior.
- [ ] Rollback/support monitoring is staffed for review and launch.

Official policy references: [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [Apple account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/), [Google Payments](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en), [Google account deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en), and [Google Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en).
