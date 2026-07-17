# VyapaarMate Intelligence Data Sources and Model Readiness

VyapaarMate uses a hybrid intelligence engine. Compatible first-party models are used only after every readiness gate passes; otherwise the product returns explainable rules and statistical signals with a `needs_data` state. Limited operational history is shown as preliminary/low-confidence instead of as a mature business-health result.

## Production data boundary

Production training reads only records that have both:

- `trainingEligible = true`
- `dataOrigin` in `LIVE`, `HISTORICAL_IMPORT`, or `MANUAL`

The allowed tables are `Business`, `MenuItem`, `MenuCategory`, `Order`, `OrderItem`, `Customer`, and `Payment`. `EXTERNAL_BENCHMARK`, `DEMO`, `SEED`, and `TEST` records are excluded at the database-query boundary. Database constraints prevent non-production origins from being marked training-eligible.

Synthetic fixtures stay inside tests. External benchmarks stay in offline evaluation tooling. Neither can affect tenant training, readiness, health scores, predictions, or automatic owner actions.

## External benchmark registry

The source of truth is `config/intelligence-benchmarks.json`.

| Dataset | Status | Permitted purpose | Production use |
| --- | --- | --- | --- |
| UCI Online Retail II (2009–2011) | Master evaluation dataset | Importer, demand, RFM, return, and cancellation backtests | Prohibited |
| UCI Online Retail (2010–2011) | Excluded duplicate/subset | Duplicate and checksum checks only | Prohibited |
| Medical Appointments No-Show | Restricted evaluation only | Generic offline appointment and attendance-pipeline tests | Prohibited |
| M5 `calendar-selected-columns.csv` | Incomplete calendar-only export | Offline calendar-join tests | Prohibited |

The medical benchmark excludes sensitive and diagnosis-related fields listed in the registry. It must not be used for customer-level prediction or salon accuracy claims. The M5 export contains calendar context only, is US-centric, and is not a demand-training dataset.

Downloaded benchmark files are intentionally not committed. The registry locks the exact approved files by SHA-256. Verify a supplied set with:

```bash
npm run intelligence:verify-benchmarks -- --dir /path/to/downloads
```

A missing or changed file fails verification. `--allow-unlocked` is available only while an explicitly reviewed new dataset version is being fingerprinted; it must not be used for an import or published evaluation.

## Runtime modes and artifact compatibility

- `rules_engine`: no compatible first-party artifact is active.
- `trained_ml`: all three model families have compatible trained artifacts.
- `hybrid_rules_plus_ml`: at least one family is trained; rules/statistics fill the remaining gaps.

Every artifact stores a `featureSchemaVersion`. Loading and status queries reject artifacts from an older schema, so models trained with leaked or obsolete features cannot silently return to service after a deployment.

Lifecycle data is stored in `IntelligenceModelArtifact`, `IntelligenceTrainingRun`, and `IntelligencePrediction`. Supported model states are `needs_data`, `ready_for_training`, `training`, `shadow`, `trained`, `failed`, and `disabled`. Artifact lifecycle states are `shadow`, `active`, `retired`, and `rolled_back`; only a compatible active artifact serves predictions.

## Minimum readiness gates

Every gate in a model family must pass.

### Demand

- At least 90 days of completed-order history.
- At least 300 completed orders with linked catalog items.
- At least 30 active completed-order days.
- At least 80% of completed items linked to catalog records.

### Retention

- At least 100 customers.
- At least 300 customer-linked, non-cancelled orders.
- At least 20 repeat customers.
- Enough customer order history for point-in-time train/validation labels: 105 days for a 30-day return horizon, 143 days for 45 days, or 180 days for 60 days.

### Payment risk

- At least 300 resolved payment outcomes.
- At least 50 successful outcomes.
- At least 30 explicitly failed outcomes.

`PENDING` is unresolved and is never a failed training label. `REFUNDED` is also excluded from this failure classifier. A pending payment may be scored at prediction time, but its current payment status, final order status, and eventual outcome are not input features.

## Model features and labels

Demand forecasting uses regularized linear regression over completed order-item quantities. Its time axis is `completedAt`, then `scheduledFor`, with `createdAt` only as a legacy fallback. Features include calendar position, safely encoded item/category identity, historical quantities, prior order trends, average order value, and prior payment success ratio.

Retention uses logistic regression over historical customer snapshots. Features include prior order frequency, recency, average order value, first-order age, and payment success history. Customer names, phone numbers, addresses, and free-text notes are excluded.

Payment risk uses logistic regression over resolved `COMPLETED`/`PAID` versus `FAILED` outcomes. Features include amount, provider, and only the customer's resolved outcomes that existed before the candidate payment. Current/final status fields are deliberately excluded to prevent label leakage.

## Appointment outcome truth

Businesses with scheduled services must capture `Order.scheduledFor`. Owners can record a no-show only after the scheduled time and only while the booking is in an active accepted/preparation state. A no-show stores `noShowAt`, `cancelledAt`, and a cancellation reason, but it does not refund or otherwise mutate payment state. Ordinary business cancellation keeps the existing payment/refund workflow.

## APIs and refresh lifecycle

```http
POST /api/intelligence/train
GET /api/intelligence/model-status?businessId=business_id
GET /api/intelligence/predictions?businessId=business_id
POST /api/intelligence/rollback
GET /api/intelligence/data-sources
GET /api/intelligence/accuracy?days=14
```

Owner/admin routes verify access to the requested business. The protected `/api/jobs/intelligence-refresh` job materializes rules outputs, checks all gates, trains only when needed, stores candidates in shadow, promotes only candidates that beat their baseline gates, checks feature drift, generates active compatible-model predictions, and preserves rules fallback for every untrained family. Two consecutive critical drift checks attempt to restore the latest compatible retired artifact.

## Privacy and maintenance

- Do not train on names, phone numbers, addresses, protected/sensitive attributes, diagnoses, or free-text notes.
- Tokenize customer identifiers before an offline export.
- Use consent fields only for communication eligibility.
- Do not introduce cross-business aggregate training without explicit product, privacy, legal, and consent review.
- Keep service-role/database credentials server-side and do not expose raw training rows or artifacts to browsers.
- Review readiness and accuracy weekly, and after material catalog, pricing, scheduling, operating-hours, or campaign changes.

Tests use synthetic records only to verify gates, feature extraction, leakage prevention, artifact invalidation, external-data isolation, predictions, fallback, governance, and access checks.
