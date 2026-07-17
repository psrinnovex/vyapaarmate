import {
  calculateDemandForecast,
  type BusinessIntelligenceDataset,
  type DemandForecastResult,
  type IntelligenceOrder,
  type IntelligenceOrderItem,
  type IntelligenceTimeSlot
} from "@/lib/business-intelligence";
import { getBusinessIntelligenceDataset } from "@/lib/business-intelligence-data";
import {
  addBusinessDays as addDays,
  businessHour,
  startOfBusinessDay as startOfDay
} from "@/lib/intelligence/intelligence-time";

export type DemandForecastAccuracySample = {
  forecastDate: string;
  timeSlot: IntelligenceTimeSlot;
  productId: string | null;
  productName: string;
  predictedQuantity: number;
  actualQuantity: number;
  absoluteError: number;
  absolutePercentError: number | null;
  symmetricPercentError: number;
  confidence: DemandForecastResult["confidence"] | "Missed";
  confidenceScore: number;
  withinTolerance: boolean;
};

export type DemandForecastAccuracySummary = {
  status: "ready" | "insufficient_data";
  grade: "A" | "B" | "C" | "D" | "Insufficient";
  backtestDays: number;
  evaluatedSamples: number;
  forecastedSamples: number;
  missedDemandSamples: number;
  totalPredictedQuantity: number;
  totalActualQuantity: number;
  meanAbsoluteError: number;
  rootMeanSquaredError: number;
  weightedAbsolutePercentError: number | null;
  forecastAccuracyScore: number | null;
  biasPercent: number | null;
  withinToleranceRate: number | null;
};

export type ConfidenceCalibrationBucket = {
  confidence: DemandForecastResult["confidence"] | "Missed";
  samples: number;
  meanAbsoluteError: number;
  weightedAbsolutePercentError: number | null;
  withinToleranceRate: number | null;
};

export type BusinessIntelligenceAccuracyReport = {
  generatedAt: string;
  business: BusinessIntelligenceDataset["business"];
  source: BusinessIntelligenceDataset["source"];
  dataWindow: string;
  demandForecastAccuracy: {
    summary: DemandForecastAccuracySummary;
    byConfidence: ConfidenceCalibrationBucket[];
    samples: DemandForecastAccuracySample[];
  };
  maintenance: {
    reviewCadence: string;
    minimumDataNeeded: string;
    recommendations: string[];
  };
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function timeSlotForDate(date: Date): IntelligenceTimeSlot {
  const hour = businessHour(date);
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 16) return "afternoon";
  if (hour >= 16 && hour < 21) return "evening";
  return "night";
}

function productKey(item: Pick<IntelligenceOrderItem, "productId" | "productName">) {
  return item.productId ?? item.productName.trim().toLowerCase();
}

function forecastKey(forecast: DemandForecastResult) {
  return forecast.productId ?? forecast.productName.trim().toLowerCase();
}

function isFinalOrActiveOrder(order: IntelligenceOrder) {
  return order.status !== "CANCELLED";
}

function orderActivityAt(order: IntelligenceOrder) {
  return order.completedAt ?? order.scheduledFor ?? order.createdAt;
}

function actualDemandForDateSlot({
  orders,
  targetDate,
  timeSlot
}: {
  orders: IntelligenceOrder[];
  targetDate: Date;
  timeSlot: IntelligenceTimeSlot;
}) {
  const targetStart = startOfDay(targetDate);
  const targetEnd = addDays(targetStart, 1);
  const actuals = new Map<string, { productId: string | null; productName: string; quantity: number }>();

  orders
    .filter((order) => {
      const activityAt = orderActivityAt(order);
      return isFinalOrActiveOrder(order) && activityAt >= targetStart && activityAt < targetEnd && timeSlotForDate(activityAt) === timeSlot;
    })
    .forEach((order) => {
      order.items.forEach((item) => {
        const key = productKey(item);
        const existing = actuals.get(key);
        actuals.set(key, {
          productId: item.productId ?? existing?.productId ?? null,
          productName: existing?.productName ?? item.productName,
          quantity: (existing?.quantity ?? 0) + item.quantity
        });
      });
    });

  return actuals;
}

function confidenceGrade(score: number | null, samples: number): DemandForecastAccuracySummary["grade"] {
  if (score === null || samples < 10) return "Insufficient";
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  return "D";
}

function aggregateSamples(samples: DemandForecastAccuracySample[], backtestDays: number): DemandForecastAccuracySummary {
  const totalPredictedQuantity = samples.reduce((sum, sample) => sum + sample.predictedQuantity, 0);
  const totalActualQuantity = samples.reduce((sum, sample) => sum + sample.actualQuantity, 0);
  const totalAbsoluteError = samples.reduce((sum, sample) => sum + sample.absoluteError, 0);
  const totalSquaredError = samples.reduce((sum, sample) => sum + sample.absoluteError ** 2, 0);
  const weightedAbsolutePercentError = totalActualQuantity > 0 ? (totalAbsoluteError / totalActualQuantity) * 100 : null;
  const forecastAccuracyScore = weightedAbsolutePercentError === null ? null : clamp(100 - weightedAbsolutePercentError, 0, 100);
  const biasPercent = totalActualQuantity > 0 ? ((totalPredictedQuantity - totalActualQuantity) / totalActualQuantity) * 100 : null;
  const withinToleranceRate = samples.length ? (samples.filter((sample) => sample.withinTolerance).length / samples.length) * 100 : null;
  const forecastedSamples = samples.filter((sample) => sample.predictedQuantity > 0).length;
  const missedDemandSamples = samples.filter((sample) => sample.predictedQuantity === 0 && sample.actualQuantity > 0).length;
  const meanAbsoluteError = samples.length ? totalAbsoluteError / samples.length : 0;
  const rootMeanSquaredError = samples.length ? Math.sqrt(totalSquaredError / samples.length) : 0;
  const grade = confidenceGrade(forecastAccuracyScore, samples.length);

  return {
    status: samples.length >= 10 ? "ready" : "insufficient_data",
    grade,
    backtestDays,
    evaluatedSamples: samples.length,
    forecastedSamples,
    missedDemandSamples,
    totalPredictedQuantity,
    totalActualQuantity,
    meanAbsoluteError: round(meanAbsoluteError, 2),
    rootMeanSquaredError: round(rootMeanSquaredError, 2),
    weightedAbsolutePercentError: weightedAbsolutePercentError === null ? null : round(weightedAbsolutePercentError, 2),
    forecastAccuracyScore: forecastAccuracyScore === null ? null : round(forecastAccuracyScore, 2),
    biasPercent: biasPercent === null ? null : round(biasPercent, 2),
    withinToleranceRate: withinToleranceRate === null ? null : round(withinToleranceRate, 2)
  };
}

function aggregateConfidenceBuckets(samples: DemandForecastAccuracySample[]): ConfidenceCalibrationBucket[] {
  const buckets = new Map<DemandForecastAccuracySample["confidence"], DemandForecastAccuracySample[]>();

  samples.forEach((sample) => {
    buckets.set(sample.confidence, [...(buckets.get(sample.confidence) ?? []), sample]);
  });

  return Array.from(buckets.entries())
    .map(([confidence, bucketSamples]) => {
      const totalActual = bucketSamples.reduce((sum, sample) => sum + sample.actualQuantity, 0);
      const totalAbsoluteError = bucketSamples.reduce((sum, sample) => sum + sample.absoluteError, 0);
      const wape = totalActual > 0 ? (totalAbsoluteError / totalActual) * 100 : null;
      const withinToleranceRate = bucketSamples.length ? (bucketSamples.filter((sample) => sample.withinTolerance).length / bucketSamples.length) * 100 : null;

      return {
        confidence,
        samples: bucketSamples.length,
        meanAbsoluteError: round(totalAbsoluteError / Math.max(1, bucketSamples.length), 2),
        weightedAbsolutePercentError: wape === null ? null : round(wape, 2),
        withinToleranceRate: withinToleranceRate === null ? null : round(withinToleranceRate, 2)
      };
    })
    .sort((first, second) => {
      const order = { High: 0, Medium: 1, Low: 2, Missed: 3 };
      return order[first.confidence] - order[second.confidence];
    });
}

function maintenanceRecommendations(summary: DemandForecastAccuracySummary, byConfidence: ConfidenceCalibrationBucket[]) {
  const recommendations: string[] = [];

  if (summary.status === "insufficient_data") {
    recommendations.push("Collect at least 10 forecast-vs-actual samples before treating the score as stable.");
  }

  if ((summary.weightedAbsolutePercentError ?? 0) > 50) {
    recommendations.push("Treat demand forecasts as directional until WAPE stays below 50% for two review cycles.");
  }

  if ((summary.biasPercent ?? 0) > 20) {
    recommendations.push("The engine is over-forecasting; reduce preparation buffers for high-volume products until bias improves.");
  } else if ((summary.biasPercent ?? 0) < -20) {
    recommendations.push("The engine is under-forecasting; add buffer stock for high-confidence forecasts and review missed-demand products.");
  }

  if (summary.missedDemandSamples > Math.max(2, summary.evaluatedSamples * 0.25)) {
    recommendations.push("Missed demand is high; keep catalog item mapping clean so orders consistently link to menu items.");
  }

  const high = byConfidence.find((bucket) => bucket.confidence === "High");
  const medium = byConfidence.find((bucket) => bucket.confidence === "Medium");
  if (high?.weightedAbsolutePercentError !== null && medium?.weightedAbsolutePercentError !== null && high && medium && high.weightedAbsolutePercentError > medium.weightedAbsolutePercentError) {
    recommendations.push("High-confidence forecasts are not outperforming medium-confidence forecasts; recalibrate confidence thresholds.");
  }

  if (!recommendations.length) {
    recommendations.push("Accuracy is acceptable for current data; keep monitoring weekly and after major menu or operations changes.");
  }

  recommendations.push("Review this report weekly and after pricing, menu, hours, delivery area, or campaign changes.");

  return recommendations;
}

function buildSamples({
  dataset,
  backtestDays
}: {
  dataset: BusinessIntelligenceDataset;
  backtestDays: number;
}): DemandForecastAccuracySample[] {
  const now = startOfDay(dataset.now ?? new Date());
  const slots: IntelligenceTimeSlot[] = ["morning", "afternoon", "evening", "night"];
  const samples: DemandForecastAccuracySample[] = [];

  for (let offset = backtestDays; offset >= 1; offset -= 1) {
    const targetDate = addDays(now, -offset);

    slots.forEach((timeSlot) => {
      const forecasts = calculateDemandForecast({
        orders: dataset.orders,
        products: dataset.products,
        date: targetDate,
        timeSlot,
        windowDays: 30
      });
      const forecastByKey = new Map(forecasts.map((forecast) => [forecastKey(forecast), forecast]));
      const actualByKey = actualDemandForDateSlot({ orders: dataset.orders, targetDate, timeSlot });
      const keys = new Set([...forecastByKey.keys(), ...actualByKey.keys()]);

      keys.forEach((key) => {
        const forecast = forecastByKey.get(key);
        const actual = actualByKey.get(key);
        const predictedQuantity = forecast?.predictedQuantity ?? 0;
        const actualQuantity = actual?.quantity ?? 0;
        if (predictedQuantity === 0 && actualQuantity === 0) return;

        const absoluteError = Math.abs(predictedQuantity - actualQuantity);
        const absolutePercentError = actualQuantity > 0 ? (absoluteError / actualQuantity) * 100 : null;
        const symmetricDenominator = predictedQuantity + actualQuantity;
        const symmetricPercentError = symmetricDenominator > 0 ? (2 * absoluteError * 100) / symmetricDenominator : 0;
        const tolerance = Math.max(2, actualQuantity * 0.2);

        samples.push({
          forecastDate: targetDate.toISOString(),
          timeSlot,
          productId: forecast?.productId ?? actual?.productId ?? null,
          productName: forecast?.productName ?? actual?.productName ?? key,
          predictedQuantity,
          actualQuantity,
          absoluteError,
          absolutePercentError: absolutePercentError === null ? null : round(absolutePercentError, 2),
          symmetricPercentError: round(symmetricPercentError, 2),
          confidence: forecast?.confidence ?? "Missed",
          confidenceScore: forecast?.confidenceScore ?? 0,
          withinTolerance: absoluteError <= tolerance
        });
      });
    });
  }

  return samples.sort((first, second) => {
    if (first.forecastDate !== second.forecastDate) return first.forecastDate.localeCompare(second.forecastDate);
    if (first.timeSlot !== second.timeSlot) return first.timeSlot.localeCompare(second.timeSlot);
    return second.actualQuantity - first.actualQuantity;
  });
}

export function evaluateBusinessIntelligenceAccuracy({
  dataset,
  backtestDays = 7,
  includeSamples = false
}: {
  dataset: BusinessIntelligenceDataset;
  backtestDays?: number;
  includeSamples?: boolean;
}): BusinessIntelligenceAccuracyReport {
  const boundedBacktestDays = Math.min(21, Math.max(3, Math.floor(backtestDays)));
  const samples = buildSamples({ dataset, backtestDays: boundedBacktestDays });
  const summary = aggregateSamples(samples, boundedBacktestDays);
  const byConfidence = aggregateConfidenceBuckets(samples);

  return {
    generatedAt: (dataset.now ?? new Date()).toISOString(),
    business: dataset.business,
    source: dataset.source,
    dataWindow: dataset.source === "demo" ? "Demo sample data" : "Historical backtest from loaded order window",
    demandForecastAccuracy: {
      summary,
      byConfidence,
      samples: includeSamples ? samples : samples.slice(0, 25)
    },
    maintenance: {
      reviewCadence: "Review weekly, and after menu, pricing, hours, delivery-area, or campaign changes.",
      minimumDataNeeded: "At least 30 days of orders with menu-item links gives the forecast enough history for stable weekday and slot patterns.",
      recommendations: maintenanceRecommendations(summary, byConfidence)
    }
  };
}

export async function getBusinessIntelligenceAccuracyReport({
  businessId,
  backtestDays = 7,
  includeSamples = false
}: {
  businessId: string;
  backtestDays?: number;
  includeSamples?: boolean;
}) {
  const dataset = await getBusinessIntelligenceDataset(businessId);
  return evaluateBusinessIntelligenceAccuracy({ dataset, backtestDays, includeSamples });
}
