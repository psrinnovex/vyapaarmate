# App Store And Play Store Readiness

Date: 2026-08-18
Status: superseded historical PWA audit — current store status remains **BLOCKED**

This document was a PWA-focused assessment on 2026-08-17. It is retained to explain the earlier web findings, but it must not be used as the current source of truth for native-store readiness. Use [`docs/store-release/README.md`](./store-release/README.md) and its checklist for the active release record.

## Current corrections

- A genuine Expo/React Native client now exists locally at `apps/mobile`, together with App Store Connect and Google Play metadata drafts in `docs/store-release/`.
- A local Android release-mode APK exists and was used for emulator QA, but it is debug-signed and not uploadable to Play. No signed AAB exists.
- iOS configuration resolves to the intended bundle identifier and privacy/authentication configuration, but there is no signed archive, IPA, TestFlight run, or App Store Connect record.
- The public mobile privacy and terms pages, account-deletion resource, reviewer-fixture script, and mobile server contracts exist in source. Their production deployment and device behavior are unproven.
- The production configuration gate currently fails on required secrets, mobile token/deletion settings, retention approval, Redis, Maps, and launch settings.

## Still required before any submission

1. Freeze the mobile source, root API changes, migrations, and store materials in an immutable release commit.
2. Configure and verify the production deployment, Supabase migrations, provider settings, public privacy/terms/deletion URLs, and reviewer fixtures against the exact authorized database.
3. Build and inspect a Play-signed AAB and an Apple-signed archive; run TestFlight and Play internal/closed testing on clean physical devices.
4. Complete every store declaration from the final deployed binary, network traces, bundled SDK inventory, processor contracts, and approved retention policy.
5. Obtain the owner-approved legal entity/contact, countries, ratings, trader/financial/ads/export decisions, reviewer accounts, screenshots, and release authorization.

The website/PWA evidence remains separate: it does not prove native signing, store console state, production configuration, database migrations, or physical-device native behavior.
