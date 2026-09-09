# VyapaarMate native app

This is the genuine React Native client for iPhone, iPad, and Android. The Next.js application at the repository root remains the responsive website and installable desktop experience for macOS, Windows, Linux, and ChromeOS.

## Product boundary

- Native customer access: browse approved physical/in-person businesses, submit cash-at-fulfillment orders or appointments, view bookings, export personal data, revoke sessions, and delete the account.
- Native business access: operational overview, orders, appointments, session controls, and owner/staff deletion appropriate to the signed-in role.
- Website-only: administrator and support-agent accounts, business signup/pricing/subscription purchase or renewal, KYC uploads, payout setup, and other back-office configuration.
- Mobile catalogue fails closed. Pharmacy/prescription goods, alcohol, tobacco/nicotine, controlled goods, remote/digital services, and unreviewed business categories are excluded by the server as well as the client.

## Security model

The app uses the system browser for first-party authentication, Authorization Code + PKCE, a fixed reverse-domain redirect, 10-minute audience-bound access tokens held only in memory, and rotating opaque refresh tokens stored in SecureStore. An install marker removes iOS Keychain credentials that survive an uninstall. Administrator/support roles are rejected before a mobile authorization code can be issued.

Authenticated API calls accept relative `/api/` paths only and never send bearer credentials to another origin. Mobile order submission requires a user-scoped idempotency key and currently permits only payment at physical fulfillment.

## Local requirements

- Node.js 22.x (EAS profiles pin Node 22.22.0)
- Xcode 26.4 or later for SDK 57 iOS builds
- Android SDK/target API 36
- JDK 17 for Android builds

Install and verify:

```bash
npm install
npm run verify
```

Generate clean native projects without committing generated `ios/` or `android/` folders:

```bash
npx expo prebuild --clean
```

On this Mac, run Android commands with:

```bash
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home npm run android
```

Run iOS with `npm run ios`. Use `VyapaarMate_API_36` for the isolated Android API 36 emulator profile.

## Release identity

- Expo owner: `pshr_innovex_org`
- Slug: `vyapaarmate`
- iOS bundle identifier: `com.pshrinnovex.vyapaarmate`
- Android package: `com.pshrinnovex.vyapaarmate`
- Native redirect: `com.pshrinnovex.vyapaarmate://oauth2redirect`
- Production API: `https://www.vyapaarmate.com`

Build and submit commands must be run from this directory, never from the repository root. `app.config.ts` is the intended local version source of truth, but this mobile workspace is currently untracked in the surrounding checkout. Capture it in an immutable release commit before treating any local build as release provenance. Store uploads remain draft/internal until signed-artifact QA, owner legal declarations, and reviewer credentials are complete.
