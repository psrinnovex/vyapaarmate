# VyapaarMate Cross-Platform Delivery

Date: 2026-08-17

## Supported product surfaces

| Audience | Website | iPhone/iPad install | Android install | Windows install | Mac install |
| --- | --- | --- | --- | --- | --- |
| Customers | Yes | Yes | Yes | Yes | Yes |
| Business owners and staff | Yes | Yes | Yes | Yes | Yes |
| Super admin | Yes | Not offered | Not offered | Yes | Yes |
| Support agents | Yes | Not offered | Not offered | Yes | Yes |

The installable product is a Progressive Web App (PWA). It uses the same responsive Next.js application, same-origin HttpOnly session cookie, server-side role checks, and hosted APIs as the website. It does not create a second data path or expose Supabase/PostgreSQL directly to a device.

The role-aware install prompt fails closed until `/api/auth/session` confirms a supported account. Phone installation is offered only to verified customer/business roles, while Windows and macOS installation is offered to every verified role. Admin/support routes and login destinations suppress phone installation. Query-string navigation is re-evaluated so switching from a business login destination to admin/support cannot retain stale eligibility.

This is a product-distribution rule, not an authorization boundary. A public same-origin PWA cannot prevent a person from using the browser's manual Add to Home Screen command. Server layouts, route handlers, and `proxy.ts` remain responsible for data security; a future native client must enforce its audience through server-issued mobile credentials.

## Installation

- iPhone/iPad: open the site in Safari, tap Share, choose **Add to Home Screen**, enable **Open as Web App**, and tap **Add**.
- Android: open the site in Chrome or Edge and choose **Install app** from the prompt or browser menu.
- Windows: use the install icon in the Chrome or Edge address bar, or choose **Install VyapaarMate** from the browser menu.
- macOS Sonoma 14 or later: in Safari choose **File > Add to Dock**. Chrome and Edge also expose an install action.
- Any device can continue to use the normal HTTPS website without installing anything.

Linux and ChromeOS continue to use the website but are not part of the published desktop-install matrix.

The public `/install` page presents these instructions and the role matrix.

## Privacy and offline behavior

- The service worker never intercepts `/api/*` requests.
- Navigations remain network-first and fall back only to the public offline page.
- Private dashboard, user, admin, and support HTML is not cached for offline replay.
- Only VyapaarMate-owned cache versions are deleted during service-worker upgrades; unrelated origin caches are left untouched.
- Current bookings, appointments, payments, orders, and customer records require a live connection.
- The manifest avoids Window Controls Overlay because the shared headers do not implement that title-bar contract.
- Shared role-specific manifest shortcuts are omitted so an installed app cannot send a customer into a business route, or vice versa.

## Verification gates

Source and build checks:

```bash
npm run test:platform
npm run test:security
npm run typecheck
npm run lint
npm run build
```

Rendered responsive QA uses `scripts/qa/responsive-audit.mjs`. Public, customer, and business routes run at phone, tablet, and desktop widths. Admin and support routes run at desktop widths only. Seed only a local or explicitly confirmed disposable staging database with `scripts/seed-responsive-audit-users.mjs`; the script refuses an unconfirmed hosted database.

Production installability still requires HTTPS, a successful production deployment, a browser install check, and real-device installation on at least one iPhone/iPad, Android device, Windows machine, and supported Mac. Local source/build success is not deployment or physical-device proof.

## Native App Store and Play Store binaries

The root PWA and the native app are separate delivery surfaces. Do not package the hosted Next.js website as a thin mobile WebView: it depends on dynamic route handlers, Prisma, proxy headers, same-origin cookies, and CSRF checks.

A genuine Expo/React Native client lives at `apps/mobile`. It has separate, audience-bound mobile authentication and native APIs for `CUSTOMER`, `OWNER`, `MANAGER`, `KITCHEN_STAFF`, and `DELIVERY_STAFF`; `SUPER_ADMIN` and `SUPPORT_AGENT` remain website/desktop-only. The client uses short-lived access tokens and rotating refresh credentials in Keychain/Keystore, rather than reusing the browser cookie contract.

Current native evidence is preparation only:

- `apps/mobile` is currently untracked in this checkout. Its generated `ios/` and `android/` folders are intentionally ignored, so the source is not yet immutable release provenance.
- A local Android release-mode APK exists for emulator QA, but it is debug-signed and is not a Play-uploadable AAB.
- No signed iOS archive/IPA, signed Android AAB, TestFlight build, Play upload, or physical-device release QA is available.

Before any store submission, capture the mobile source in an immutable release commit; build signed upload artifacts; inspect the exact artifacts and dependency/privacy reports; deploy and verify the production API and public legal/deletion URLs; test the reviewer journeys on clean physical iPhone and Android devices; and complete the owner-approved Apple and Google declarations. Until then, describe iOS and Android support as an installable web app plus native store preparation—not an App Store IPA or Play Store AAB release.
