# Bhojzo Intelligence Data Sources and Model Readiness

Bhojzo uses a hybrid intelligence engine. Where sufficient real business history exists, trained first-party ML models generate forecasts and risk scores. Where data is insufficient, Bhojzo falls back to explainable rules/statistical recommendations and marks the model as `needs_data`.

Production ML trains only from first-party application tables:

- `Business`
- `MenuItem`
- `MenuCategory`
- `Order`
- `OrderItem`
- `Customer`
- `Payment`

No external datasets are used. Synthetic data is allowed only inside tests and is never a production training source.

## Runtime Modes

- `rules_engine`: no trained first-party model artifact is active, so Bhojzo returns explainable rules/statistical recommendations.
- `trained_ml`: all model families have trained artifacts from first-party data.
- `hybrid_rules_plus_ml`: at least one model family is trained, and the remaining gaps are filled by the rules/statistical engine.

## Model Lifecycle

Real AI Intelligence v1 stores:

- `IntelligenceModelArtifact`: trained artifact, model version, algorithm, feature schema, weights/artifact JSON, metrics, and training window.
- `IntelligenceTrainingRun`: training status, rows used, train/validation split, metrics, completion time, and error message.
- `IntelligencePrediction`: model prediction JSON, confidence, explanation JSON, model version, entity type, and entity id.

Model statuses are:

- `needs_data`
- `ready_for_training`
- `training`
- `trained`
- `failed`
- `disabled`

## Minimum Data Gates

- Demand forecasting requires at least 90 days of completed order history or at least 300 completed orders with linked order items.
- Retention requires at least 100 customers or at least 300 customer-linked orders.
- Payment risk requires at least 300 payments, at least 50 successful payments, and at least 30 failed or pending examples.

If a gate fails, the API returns `needs_data` with exact missing requirements. It does not create or claim a trained model.

## Models

Demand forecasting uses regularized linear regression trained from historical `OrderItem` quantities. Features include day of week, week of month, month, safely encoded item/category identity, recent 7/14/30 day quantity, average order value, payment success ratio, and order count trend. Metrics include MAE, RMSE, and MAPE where valid.

Retention uses logistic regression trained from customer/order snapshots. Features include total orders, days since last order, average order value, payment success rate, first order age, and order frequency. Metrics include accuracy, precision, recall, F1, and AUC where practical.

Payment risk uses logistic regression trained from payment/order history. Features include payment method, order value, previous payment success ratio, prior pending/failed count, order status, and payment status. Metrics include accuracy, precision, recall, and F1.

## API Examples

Train one or all model families:

```http
POST /api/intelligence/train
Content-Type: application/json

{
  "businessId": "business_id",
  "modelType": "all"
}
```

Check readiness, versions, metrics, and missing data:

```http
GET /api/intelligence/model-status?businessId=business_id
```

Return trained ML predictions when artifacts exist, otherwise return rules-engine fallback:

```http
GET /api/intelligence/predictions?businessId=business_id
```

Review governance, data lineage, privacy notes, and model readiness:

```http
GET /api/intelligence/data-sources
GET /api/intelligence/accuracy?days=14
```

All owner/admin model routes verify the authenticated user can access the requested business. `businessId` is never trusted by itself.

## Refresh Job

`/api/jobs/intelligence-refresh` remains protected by `Authorization: Bearer $CRON_SECRET`.

On each refresh it:

1. Materializes the existing rules/statistical intelligence outputs.
2. Checks model readiness for each model family.
3. Trains only when data gates pass and no recent valid model exists.
4. Generates predictions from trained artifacts.
5. Falls back to rules/statistical recommendations when no trained artifact is available.

## Supabase and RLS

The app uses server-side Prisma. Supabase generated Data API access remains revoked for these model lifecycle tables. RLS is enabled, and tenant-scoped authenticated read policies are present as defense in depth if a future migration deliberately grants table access.

Do not expose model artifacts, training rows, or predictions publicly.

## Privacy Rules

- Do not train on customer names, phone numbers, addresses, or free-text notes.
- Use customer identifiers only as entity references and owner-facing output keys.
- Use consent fields for campaign eligibility, not as pressure signals.
- Keep service-role and database credentials server-side only.
- Do not use cross-business aggregate training without explicit product, legal, consent, and privacy approval.

## Tests

Unit tests use synthetic records only inside test files to verify feature extraction, gates, training, prediction, fallback, governance honesty, and access checks. Synthetic fixtures must never be loaded as production training data.
