# Verified Facts And Owner Inputs

Date checked: 2026-08-17

## Repository-verified facts

| Field | Verified value | Evidence |
| --- | --- | --- |
| Product name | VyapaarMate | `lib/site.ts` |
| Legal company name used by the product | PSHR INNOVEX PRIVATE LIMITED | `lib/site.ts` |
| General support email | `support@pshrinnovex.com` | `lib/site.ts` |
| Production website origin used as fallback | `https://www.vyapaarmate.com` | `lib/site.ts` |
| Website support page | `https://www.vyapaarmate.com/contact` | `app/contact/page.tsx` |
| Mobile privacy URL prepared in source | `https://www.vyapaarmate.com/mobile/privacy` | `app/mobile/privacy/page.tsx` |
| Mobile terms URL prepared in source | `https://www.vyapaarmate.com/mobile/terms` | `app/mobile/terms/page.tsx` |
| External deletion resource prepared in source | `https://www.vyapaarmate.com/account-deletion` | `app/account-deletion/page.tsx` after implementation |
| Mobile product roles | Customer, owner, manager, kitchen staff, delivery staff | `lib/platform-access.ts` and mobile API policy |
| Mobile-excluded roles | Super admin and support agent | `lib/platform-access.ts` and mobile API policy |
| Configured iOS bundle identifier | `com.pshrinnovex.vyapaarmate` | `apps/mobile/app.config.ts` |
| Configured Android application ID | `com.pshrinnovex.vyapaarmate` | `apps/mobile/app.config.ts` |
| Configured first release version/build | `1.0.0`, iOS build `1`, Android version code `1` | `apps/mobile/app.config.ts` |
| Local Android QA artifact | Release-mode APK only; SHA-256 `8c026e5729dfdaa65a9b6e381b0a37d49986b26e556e2bd67b242d620e2d05ba`; debug-signed and not Play-uploadable | `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` and its signer inspection |
| Primary listing category draft | Business | Product behavior; final console selection remains an owner decision |
| Customer commerce | Local physical goods and services | `lib/business-service-types.ts`, order and appointment routes |
| Business billing | VyapaarMate software subscription | Subscription schema and dashboard billing routes |

Source presence is not deployment proof. Every URL must return `200`, render without login where required, and show the final text on the production domain before being entered in either console.

## OWNER INPUT REQUIRED — do not infer or fabricate

- Apple Developer Team and App Store Connect account holder.
- Google Play developer account owner and verified organization details.
- Ownership/availability confirmation for the configured iOS bundle ID and Android application ID, plus the Apple SKU.
- Registered office address to publish in legal notices and store/trader disclosures.
- Designated privacy or grievance contact name/title/email. `support@pshrinnovex.com` is verified only as general support until the owner designates it for privacy notices.
- Public support phone, if one will be offered.
- Copyright holder/year and content-rights answers.
- Countries/regions of availability and any region-specific legal restrictions.
- Minimum age/target audience decision and completed Apple age-rating and Google IARC answers.
- Apple export-compliance answer based on the final binary and cryptography usage.
- Apple trader status, agreements, tax, and banking completion.
- Google ads declaration, target-audience declaration, financial-features declaration, and any applicable organization verification.
- Final data-retention schedule by record category and the legal/operational basis for each retained category.
- Final processor list, contracts, international-transfer position, and deletion/retention behavior.
- App Review and Play review contact details plus non-expiring reviewer credentials.
- Authorized release decision after counsel/compliance review.

## India legal timing note for counsel

Do not state that all Digital Personal Data Protection Act/Rules data-fiduciary duties are already operative on 2026-08-17. The official 13 November 2025 notifications use phased commencement, with many operative provisions scheduled 18 months later. The product should still be designed now for itemized data/purpose notice, a rights path, documented retention, erasure, and a prominently published privacy contact. Counsel must verify the current official Gazette text and commencement status on the actual release date.

This repository package is technical preparation, not a legal opinion.
