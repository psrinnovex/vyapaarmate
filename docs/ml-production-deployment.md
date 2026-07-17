# Production ML Deployment Runbook

This runbook deploys the demand, retention, and payment-risk lifecycle safely on Vercel and Supabase. Production inference remains tenant-specific and uses only eligible first-party records. External benchmark and synthetic test data never enter production training.

## What ships

- All 15 supported business types map to one of four feature families: food, retail, appointment, or service job.
- Retention labels use business-appropriate 30-, 45-, or 60-day return horizons, with 105, 143, or 180 days of history required so both training and future validation outcomes are mature.
- Chronological evaluation uses a future validation window and excludes training labels that were not mature at the start of validation.
- Demand candidates must beat the seasonal baseline. Retention and payment-risk candidates must beat prevalence on PR-AUC and Brier score, retain both outcome classes, and meet the calibration ceiling.
- Candidates are written as `shadow`. Only a passing candidate is promoted to `active`; only an active compatible artifact serves predictions.
- Sparse mini-batch training is bounded by rows, features, batch size, and wall time for serverless execution.
- The daily protected cron checks readiness, trains when needed, monitors inference-feature drift, and generates predictions.
- Two consecutive critical drift checks trigger an automatic rollback when a compatible retired artifact exists. An owner or super admin can also request an audited manual rollback.
- A database partial unique index prevents two concurrent runs for the same business/model pair and another prevents multiple active artifacts.

## 1. Preflight

Use Node 22 and a clean checkout of the release commit.

```bash
npm ci
npm run db:generate
npm test
npm run lint
npm run typecheck
npx prisma validate
npm run build
```

Do not deploy if any command fails. Do not seed production: `npm run db:seed` deletes application data and creates demo credentials.

## 2. Configure secrets

Set these in Vercel's encrypted environment settings; do not paste real values into source, tickets, logs, or chat.

| Variable | Scope | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Preview and Production | Supabase transaction pooler, port `6543`, for serverless application traffic |
| `DIRECT_URL` | Trusted migration runner | Supabase session pooler/direct connection, port `5432`, for Prisma migrations |
| `CRON_SECRET` | Production | Random 32+ character bearer secret automatically sent to protected Vercel Cron routes |
| `INTELLIGENCE_ML_DISABLED` | Optional emergency control | Set to `1` to disable training while rules fallback continues |

Recommended serverless URL shape:

```text
postgresql://postgres.PROJECT:PASSWORD@aws-REGION.pooler.supabase.com:6543/postgres?schema=public&sslmode=require&pgbouncer=true&connection_limit=5&pool_timeout=30
```

Recommended migration URL shape:

```text
postgresql://postgres.PROJECT:PASSWORD@aws-REGION.pooler.supabase.com:5432/postgres?schema=public&sslmode=require
```

Optional bounded-training controls have conservative defaults and hard ceilings:

| Variable | Default | Allowed range |
| --- | ---: | ---: |
| `INTELLIGENCE_ML_MAX_TRAIN_ROWS` | 50,000; retention 30,000 | 1,000–75,000 |
| `INTELLIGENCE_ML_MAX_VALIDATION_ROWS` | 10,000 | 100–20,000 |
| `INTELLIGENCE_ML_MAX_FEATURES` | 512 | 32–1,024 |
| `INTELLIGENCE_ML_BATCH_SIZE` | 8,192 | 256–16,384 |
| `INTELLIGENCE_ML_MAX_TRAINING_MS` | 40,000 | 5,000–50,000 ms |

## 3. Back up and migrate Supabase

1. Confirm the target project and make a restorable database backup.
2. From a trusted runner with `DIRECT_URL` set to the target database, inspect migration state:

   ```bash
   npx prisma migrate status
   ```

3. Apply committed migrations:

   ```bash
   npm run db:deploy
   ```

4. Run `npx prisma migrate status` again. It must report that the schema is up to date.

Migration `20260717160000_ml_production_lifecycle` is additive. It records payment resolution update time, lifecycle/evaluation/drift fields, converts the newest legacy trained artifact per business/model to `active`, retires older ones, closes abandoned training rows, and creates concurrency/lifecycle indexes.

## 4. Preview deployment

Deploy the branch to Vercel Preview after migration validation against a non-production Supabase branch/project. Preview deployments do not execute Vercel Cron automatically, so invoke the protected endpoint manually with the preview-only `CRON_SECRET`:

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://PREVIEW_HOST/api/jobs/intelligence-refresh?limit=1"
```

Verify:

- missing or incorrect authorization returns `401`;
- the response contains `checked`, `refreshed`, and `failed`;
- insufficient businesses remain on rules fallback with exact readiness gaps;
- eligible businesses create a completed training run and a shadow artifact;
- a candidate is active only when `evaluation.promotion.passed` is true;
- active artifacts generate tenant-scoped predictions without sensitive features;
- a second simultaneous request reports the existing training run instead of starting another.

Owner/super-admin checks:

```http
GET /api/intelligence/model-status?businessId=BUSINESS_ID
GET /api/intelligence/predictions?businessId=BUSINESS_ID
POST /api/intelligence/train
POST /api/intelligence/rollback
```

Manual rollback body:

```json
{
  "businessId": "BUSINESS_ID",
  "modelType": "demand",
  "reason": "Operator-confirmed accuracy regression"
}
```

## 5. Production release

1. Confirm the production migration is complete.
2. Confirm `DATABASE_URL`, `DIRECT_URL`, and `CRON_SECRET` are set in the correct secret scopes.
3. Merge the reviewed release branch and wait for the Production deployment to finish.
4. Check the deployment logs for Prisma, route, timeout, or database pool errors.
5. Call the production job once with `limit=1`, then expand only after the first result is healthy.

`vercel.json` schedules `/api/jobs/intelligence-refresh` daily at `02:00 UTC` (`07:30 IST`) with the route's default five-business batch. The route allows at most 25 businesses per call, rotates through the least recently refreshed active businesses, and stops admitting more businesses when its 270-second work budget cannot safely cover another worst-case training cycle. Deferred IDs are returned for the next protected invocation. The Vercel function has a 300-second duration. Other payment and payout jobs continue to use their existing external schedules.

## 6. Post-deploy validation

For a representative eligible and ineligible business, confirm:

- model status distinguishes `shadow` from `trained`/active;
- `baselineMetrics`, `evaluation`, promotion reasons, and validation embargo counts are present;
- classifier artifacts include Platt calibration and a decision threshold;
- `driftStatus`, `driftScore`, and `lastDriftCheckedAt` update after refresh;
- only one active artifact exists per business/model;
- no running training lease remains past five minutes;
- predictions reference the active model version;
- rules fallback is still available when no active model exists.

Useful SQL checks:

```sql
SELECT "businessId", "modelType", "lifecycleStatus", count(*)
FROM "IntelligenceModelArtifact"
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;

SELECT "businessId", "modelType", "status", "leaseExpiresAt", "startedAt"
FROM "IntelligenceTrainingRun"
WHERE "status" = 'training'
ORDER BY "startedAt";
```

## 7. Incident response

- Suspected model-quality issue: use the authenticated rollback endpoint with a specific reason. Confirm the restored version serves new predictions.
- No compatible retired artifact: set `INTELLIGENCE_ML_DISABLED=1` and redeploy. Rules/statistical fallback remains available; investigate offline before re-enabling.
- Repeated critical drift: inspect the top shifted features in `driftJson`, catalog/business-type changes, imports, and data-quality gates. Do not lower thresholds merely to force promotion.
- Stuck training: wait for the five-minute lease expiry, inspect the failed run, and retry once the cause is fixed.
- Database pressure or serverless timeout: reduce row/batch limits and cron batch size; do not increase them without measured load testing.
- Migration failure: stop deployment, preserve logs, and restore from the verified backup if required. Never improvise destructive SQL against production.

## Release evidence

Record the release commit, PR, migration output, preview URL, Vercel deployment URL, first cron response, model-status samples, and rollback drill result in the release ticket. Never include connection strings, bearer secrets, customer identifiers, raw training rows, or model artifacts.

## Platform references

- [Vercel Cron quickstart](https://vercel.com/docs/cron-jobs/quickstart)
- [Vercel Cron security and operations](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Supabase Prisma guide](https://supabase.com/docs/guides/database/prisma)
- [Supabase Postgres connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres)
