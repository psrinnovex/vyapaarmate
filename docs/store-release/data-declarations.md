# Provisional Native Data Declarations

Status: draft only. These entries are derived from repository data flows and the intended minimal mobile scope. Store answers must be based on the final installed binary, bundled SDKs, runtime configuration, processor contracts, and network traces.

| Data category | Native v1 position | Linked to account | Primary purposes | Release action |
| --- | --- | --- | --- | --- |
| Name | Collected | Yes | App functionality, account management | Declare |
| Email address | Collected | Yes | Authentication, account management, communications | Declare |
| Phone number | Collected | Yes | Authentication/verification where enabled, orders, communications | Declare |
| Physical address | Collected when entered for an order/service | Yes | Fulfilment and app functionality | Declare |
| User/account ID | Collected | Yes | Authentication, security, tenant authorization | Declare |
| Purchase/order history | Collected | Yes | Orders, appointments, invoices, support | Declare |
| Customer support content | Not collected directly by the native binary; support opens the public website | Website-dependent | Support, security, dispute handling | Re-check final navigation and declare only if the app itself transmits it |
| Other user content | Order/service notes only | Yes | App functionality and fulfilment | Declare |
| Precise location | Optional for discovery; required for an at-location service request | Discovery: no server collection. Service request: yes | Nearby sorting on device; service-radius validation and fulfilment when submitted | Declare collected, optional at app level, linked when submitted with a service request |
| Payment information | Not collected in native v1 | No | None in the binary; payment occurs to the business at physical fulfilment | Do not declare financial credentials unless the final binary changes |
| Business payout/bank data | Excluded from minimal native v1 | Yes if later enabled | Payouts | Do not expose or collect in v1; otherwise declare financial data |
| Government ID/KYC documents | Excluded from minimal native v1 | Yes if later enabled | Business verification | Do not expose or collect in v1; otherwise complete sensitive/government-ID disclosures |
| Photos/videos | Excluded unless image upload ships | Yes | Business/catalog content | Declare if final binary can upload images |
| Device/app identifiers | No hardware or advertising identifier intentionally collected; platform/app version and server session ID are recorded | Session-linked | Security and session management | Verify final network trace and SDK behavior before answering |
| App interactions | Not intentionally collected in minimal native v1 | Conditional | Analytics/product improvement | Declare if any analytics or telemetry SDK sends it |
| Crash/performance diagnostics | Not intentionally collected in minimal native v1 | Conditional | Reliability | Declare if Expo, hosting, crash, or diagnostics tooling sends it |
| Advertising data | Not intended | No | None | Confirm final AAB/IPA and remote configuration |
| Cross-company tracking | Not intended | No | None | Confirm no tracking domains/SDK behavior; ATT is not a substitute for an accurate answer |

## Apple-specific checks

- Select purposes separately: App Functionality, Account Management, Developer Communications, Analytics, Fraud Prevention/Security, or other purposes only where the final flow supports them.
- “Tracking: No” requires confirmation across the company’s and third-party SDK behavior.
- A processor exception does not excuse data VyapaarMate actually receives or uses for its own purposes.
- Validate `PrivacyInfo.xcprivacy`, required-reason APIs, tracking domains, and every Apple-listed third-party SDK manifest/signature.

## Google-specific checks

- Decide `collected`, `shared`, optional/required, and purpose for every type. “Service provider” handling depends on the actual contract and Google’s current definitions.
- Confirm encryption in transit from a clean-device trace; do not answer from intended HTTPS configuration alone.
- Mark account deletion available only after both in-app initiation and the production `/account-deletion` URL work.
- Review hosting, database, Expo, email/SMS, and any final diagnostics SDK documentation. Cashfree and Meta/WhatsApp SDKs are not embedded in native v1.

## Evidence to archive

- Final dependency/license inventory and SDK privacy documentation.
- iOS privacy manifest report and Android merged-manifest/permission report.
- Clean-install network capture for logged-out, customer, owner, staff, deletion, and physical-payment journeys.
- Screenshots of final App Privacy and Data Safety answers.
- Production privacy/deletion URL checks with timestamps.
- Processor review and authorized owner approval.
