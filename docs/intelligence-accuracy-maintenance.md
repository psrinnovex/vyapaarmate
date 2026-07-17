# VyapaarMate Intelligence Accuracy Maintenance

The Intelligence Engine is rule-based and explainable. Accuracy should be managed like an operating metric: measure it regularly, fix data quality first, then tune rules only when the measurement is stable.

## Accuracy Endpoint

Authenticated business users with report access can call:

```http
GET /api/intelligence/accuracy
GET /api/intelligence/accuracy?days=14
GET /api/intelligence/accuracy?days=14&includeSamples=1
```

The endpoint backtests demand forecasts against historical orders. It does not require a new table or Supabase Data API exposure.

## Core Metrics

- `forecastAccuracyScore`: `100 - WAPE`, capped at 0-100. Higher is better.
- `weightedAbsolutePercentError`: total absolute error divided by actual demand. Lower is better.
- `biasPercent`: positive means over-forecasting, negative means under-forecasting.
- `withinToleranceRate`: share of product-slot forecasts within max 2 units or 20% of actual demand.
- `missedDemandSamples`: actual demand that was not forecast. This often points to inconsistent menu-item links or too little history.

## Quality Gates

- Grade A: accuracy score >= 80 with enough samples.
- Grade B: accuracy score >= 65.
- Grade C: accuracy score >= 50.
- Grade D: accuracy score < 50.
- Insufficient: fewer than 10 evaluated samples.

Use grades as trend signals, not guarantees. A small shop with low order volume can swing heavily day to day.

## Maintenance Cadence

- Review weekly for active businesses.
- Review immediately after menu changes, price changes, working-hour changes, delivery-area changes, or campaign bursts.
- Keep the daily Vercel `/api/jobs/intelligence-refresh` job running so recommendations, drift checks, and persisted intelligence tables stay current. It defaults to five businesses; use an explicit protected invocation for urgent refreshes.
- Use `/api/intelligence/accuracy?days=14` for a steadier review window when volume is low.

## How To Improve Accuracy

1. Keep order items linked to `MenuItem` rows. Forecast backtesting is weaker when orders only have free-text item names.
2. Keep cancelled orders accurate. Cancelled orders are excluded from demand learning.
3. Record payments promptly. Health and payment-risk recommendations depend on payment state.
4. Capture customer consent correctly. Campaign and retention recommendations should not treat non-consented customers as marketing-ready.
5. Avoid changing item names for the same product. Prefer updating the existing item rather than creating near-duplicate products.
6. Compare confidence buckets. High-confidence forecasts should have lower error than medium or low confidence; if not, tune confidence thresholds.

## Recommended Review Process

1. Open `/api/intelligence/accuracy?days=14&includeSamples=1`.
2. Check `weightedAbsolutePercentError`, `biasPercent`, and `missedDemandSamples`.
3. Fix data issues first: menu links, cancellations, duplicate items, stale availability.
4. If data is clean and errors persist for two review cycles, tune the weights in `calculateDemandForecast`.
5. Re-run focused tests and build before deploying.
