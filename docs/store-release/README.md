# VyapaarMate Store Release Preparation

Date: 2026-08-17

Status: preparation only; not authorization to submit

This folder is the evidence and handoff package for an initial iOS and Android release. It does not state that a signed binary, console record, legal approval, device test, or store submission exists.

## Release shape

- Mobile audiences: `CUSTOMER`, `OWNER`, `MANAGER`, `KITCHEN_STAFF`, and `DELIVERY_STAFF`.
- Website and desktop audiences: every supported role.
- `SUPER_ADMIN` and `SUPPORT_AGENT`: website/desktop only; mobile credential issuance must reject them.
- Customer payments: native v1 accepts only payment directly to the business at physical fulfillment. It contains no Cashfree, card, bank, UPI, external checkout, or payment-return flow.
- Business software subscriptions: the initial native app is a consumption-only companion. It must not show prices, registration, start, upgrade, renewal, external payment links, or purchase calls-to-action.

## Files

- `verified-facts-and-owner-inputs.md`: facts found in the repository and facts the authorized account owner must provide.
- `app-store-connect-metadata.md`: Apple listing draft and human-only declarations.
- `google-play-console-metadata.md`: Google Play listing draft and human-only declarations.
- `data-declarations.md`: provisional native data inventory that must be reconciled with the final binary.
- `review-notes-template.md`: secret-free reviewer instructions template.
- `release-checklist.md`: stop/go gates for build, legal, devices, consoles, and submission.

## Reviewer fixtures

Run `scripts/seed-store-review.mjs` only against the exact confirmed database. The script is idempotent for its deterministic fixture IDs, rejects conflicting records, never deletes unrelated data, and does not create admin/support accounts, KYC documents, bank details, live WhatsApp messages, or real payment-provider transactions.

Required variables:

```text
DATABASE_URL=[SECRET]
DIRECT_URL=[SECRET IF REQUIRED BY THE DEPLOYMENT]
STORE_REVIEW_TARGET=[local|staging|production]
STORE_REVIEW_CONFIRM_DATABASE_HOST=[EXACT DATABASE_URL HOST]
STORE_REVIEW_SEED_CONFIRM=CREATE_VYAPAARMATE_STORE_REVIEW_FIXTURES

STORE_REVIEW_OWNER_EMAIL=[SECRET REVIEW EMAIL]
STORE_REVIEW_OWNER_PHONE=[SECRET E.164 PHONE]
STORE_REVIEW_OWNER_PASSWORD=[SECRET 16+ CHARACTER PASSWORD]
STORE_REVIEW_CUSTOMER_EMAIL=[SECRET REVIEW EMAIL]
STORE_REVIEW_CUSTOMER_PHONE=[SECRET E.164 PHONE]
STORE_REVIEW_CUSTOMER_PASSWORD=[SECRET 16+ CHARACTER PASSWORD]
STORE_REVIEW_DELETION_EMAIL=[SECRET DISPOSABLE REVIEW EMAIL]
STORE_REVIEW_DELETION_PHONE=[SECRET E.164 PHONE]
STORE_REVIEW_DELETION_PASSWORD=[SECRET 16+ CHARACTER PASSWORD]
```

Optional staff fixture variables must be supplied together:

```text
STORE_REVIEW_STAFF_EMAIL=[SECRET REVIEW EMAIL]
STORE_REVIEW_STAFF_PHONE=[SECRET E.164 PHONE]
STORE_REVIEW_STAFF_PASSWORD=[SECRET 16+ CHARACTER PASSWORD]
```

Production additionally requires:

```text
STORE_REVIEW_PRODUCTION_CONFIRM=PSHR_INNOVEX_APPROVES_SYNTHETIC_STORE_REVIEW_DATA
```

Never commit the values. Enter reviewer credentials only in App Store Connect and Play Console, rotate them after review, and keep the primary reviewer account separate from the disposable deletion-test account.

## Policy sources

- Apple: [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/), [App Privacy](https://developer.apple.com/app-store/app-privacy-details/), [privacy manifests](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files).
- Google: [Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en), [account deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en), [Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en), [app access](https://support.google.com/googleplay/android-developer/answer/10788890?hl=en).

Policies and console forms change. Re-check the official pages on the actual submission date.
