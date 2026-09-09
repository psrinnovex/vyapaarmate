# App Store Connect Metadata Draft

All text marked `OWNER INPUT REQUIRED` must be supplied or approved by an authorized account owner. Text marked `VERIFY IN FINAL BINARY` must be checked against the archived build, not only source code.

## Listing

| Field | Draft |
| --- | --- |
| Name | VyapaarMate |
| Subtitle | Local orders and operations |
| Primary category | Business |
| Secondary category | OWNER INPUT REQUIRED |
| Privacy Policy URL | `https://www.vyapaarmate.com/mobile/privacy` |
| Support URL | `https://www.vyapaarmate.com/contact` |
| Marketing URL | `https://www.vyapaarmate.com` |
| Account deletion resource | `https://www.vyapaarmate.com/account-deletion` |
| Bundle ID | `com.pshrinnovex.vyapaarmate` — configured in source; OWNER must verify/register availability |
| SKU | OWNER INPUT REQUIRED |
| Version | `1.0.0` (configured); must equal the uploaded binary |
| Copyright | OWNER INPUT REQUIRED |

## Promotional text draft

Manage local orders and appointments as a customer or an approved business team, with secure account controls and clear status updates.

VERIFY IN FINAL BINARY: promotional text must describe only features available in the submitted version.

## Description draft

VyapaarMate connects customers with local businesses and gives approved business teams a focused way to manage day-to-day operations.

Customers can browse available local businesses, review physical products or in-person services, place orders or appointment requests, and follow their status. Business owners and authorized staff can review operational information for their own business, including orders and appointments available to their role.

The mobile business experience is a companion for existing approved accounts. VyapaarMate software subscriptions are not sold, started, upgraded, or renewed inside the iOS app.

Account and privacy controls include secure sign-in, session management, mobile privacy information, and an account-deletion process. Super-admin and support-agent workspaces remain on VyapaarMate's protected website and desktop product and are not available in the mobile app.

Some functions require a network connection and configured services from the relevant business.

VERIFY IN FINAL BINARY: remove any sentence for a journey that is not complete and device-tested.

## Keywords draft

`business,orders,appointments,bookings,local,operations,customers,services,commerce`

Check the current App Store Connect byte limit before entry.

## Human declarations

- OWNER INPUT REQUIRED: app availability and pricing. The intended binary is free to download and contains no business SaaS purchase call-to-action.
- OWNER INPUT REQUIRED: age-rating questionnaire based on the final content.
- OWNER INPUT REQUIRED: content rights.
- OWNER INPUT REQUIRED: export compliance. Use `ITSAppUsesNonExemptEncryption=false` only if the final binary genuinely qualifies; do not infer it from HTTPS alone.
- OWNER INPUT REQUIRED: App Privacy answers reconciled to `data-declarations.md`, every bundled SDK privacy manifest, and a clean-device network trace.
- OWNER INPUT REQUIRED: trader status, agreements, tax, banking, and authorized contact details.
- VERIFY IN FINAL BINARY: no subscription price, upgrade, renewal, registration, `/pricing`, external checkout, or external-purchase call-to-action exists in the iOS app.
- VERIFY IN FINAL BINARY: `PrivacyInfo.xcprivacy` is valid and every required-reason API and listed third-party SDK is covered.

## Assets

- 1024 x 1024 opaque app icon from the final approved artwork.
- One to ten genuine app screenshots for each required device class supported by the binary.
- Screenshots must use fictional review data and show actual final app UI, not the PWA or design mockups.
- Suggested sequence: customer discovery, physical order/booking, customer status, business home, business orders/appointments, privacy/deletion.
- Do not show admin/support mobile screens or business-subscription purchase UI.

Use the current official [App information reference](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information) and [screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/) when uploading.
