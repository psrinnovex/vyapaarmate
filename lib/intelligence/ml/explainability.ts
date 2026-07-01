import type { FeatureMap, VectorModelArtifact } from "@/lib/intelligence/ml/model-registry";
import { vectorizeFeatureMap } from "@/lib/intelligence/ml/model-registry";
import { round } from "@/lib/intelligence/ml/metrics";

export type FeatureContribution = {
  feature: string;
  value: number;
  weight: number;
  contribution: number;
  direction: "increases" | "decreases";
};

function readableFeature(feature: string) {
  if (feature === "recent7Quantity") return "last 7-day sales";
  if (feature === "recent14Quantity") return "last 14-day sales";
  if (feature === "recent30Quantity") return "last 30-day sales";
  if (feature === "isWeekend") return "weekend demand";
  if (feature === "dayOfWeek") return "weekday pattern";
  if (feature === "orderCountTrend") return "completed-order frequency";
  if (feature === "averageOrderValue") return "average order value";
  if (feature === "paymentSuccessRatio") return "payment success ratio";
  if (feature === "totalOrders") return "total orders";
  if (feature === "daysSinceLastOrder") return "days since last order";
  if (feature === "orderFrequency") return "order frequency";
  if (feature === "paymentSuccessRate") return "customer payment success rate";
  if (feature === "firstOrderAgeDays") return "customer history length";
  if (feature === "orderValue") return "order value";
  if (feature === "previousPaymentSuccessRatio") return "previous payment success ratio";
  if (feature === "pendingFailedCount") return "previous pending or failed payments";
  if (feature === "paymentAgeDays") return "payment age";
  if (feature.startsWith("paymentStatus:")) return "current payment status";
  if (feature.startsWith("paymentMethod:")) return "payment method";
  if (feature.startsWith("orderStatus:")) return "order status";
  if (feature.startsWith("category:")) return "category history";
  if (feature.startsWith("item:")) return "item history";
  return feature.replace(/[A-Z]/g, (match) => ` ${match.toLowerCase()}`);
}

export function featureContributions(artifact: VectorModelArtifact, features: FeatureMap, limit = 5): FeatureContribution[] {
  const normalized = vectorizeFeatureMap(features, artifact);

  return artifact.featureNames
    .map((featureName, index) => {
      const contribution = (artifact.weights[index] ?? 0) * (normalized[index] ?? 0);
      return {
        feature: featureName,
        value: features[featureName] ?? 0,
        weight: artifact.weights[index] ?? 0,
        contribution,
        direction: contribution >= 0 ? ("increases" as const) : ("decreases" as const)
      };
    })
    .filter((contribution) => Math.abs(contribution.contribution) > 0.000001)
    .sort((first, second) => Math.abs(second.contribution) - Math.abs(first.contribution))
    .slice(0, limit)
    .map((contribution) => ({
      ...contribution,
      value: round(contribution.value, 4),
      weight: round(contribution.weight, 4),
      contribution: round(contribution.contribution, 4)
    }));
}

function joinReasons(reasons: string[]) {
  if (reasons.length === 0) return "the available first-party history matched the trained baseline";
  if (reasons.length === 1) return reasons[0]!;
  return `${reasons.slice(0, -1).join(", ")} and ${reasons[reasons.length - 1]}`;
}

export function explainDemandPrediction({
  artifact,
  features,
  itemName
}: {
  artifact: VectorModelArtifact;
  features: FeatureMap;
  itemName: string;
}) {
  const contributions = featureContributions(artifact, features);
  const positive = contributions.filter((contribution) => contribution.contribution >= 0).map((contribution) => readableFeature(contribution.feature));

  return {
    text: `Demand forecast for ${itemName} changed because ${joinReasons(positive.slice(0, 3))}.`,
    factors: contributions
  };
}

export function explainRetentionPrediction({
  artifact,
  features,
  customerName,
  repeatLikelihood
}: {
  artifact: VectorModelArtifact;
  features: FeatureMap;
  customerName: string;
  repeatLikelihood: number;
}) {
  const contributions = featureContributions(artifact, features);
  const positive = contributions.filter((contribution) => contribution.contribution >= 0).map((contribution) => readableFeature(contribution.feature));
  const negative = contributions.filter((contribution) => contribution.contribution < 0).map((contribution) => readableFeature(contribution.feature));
  const reasons = repeatLikelihood >= 0.5 ? positive : negative;

  return {
    text:
      repeatLikelihood >= 0.5
        ? `${customerName} has higher repeat likelihood because ${joinReasons(reasons.slice(0, 3))}.`
        : `${customerName} has higher inactivity risk because ${joinReasons(reasons.slice(0, 3))}.`,
    factors: contributions
  };
}

export function explainPaymentRiskPrediction({
  artifact,
  features,
  riskScore
}: {
  artifact: VectorModelArtifact;
  features: FeatureMap;
  riskScore: number;
}) {
  const contributions = featureContributions(artifact, features);
  const riskDrivers = contributions.filter((contribution) => contribution.contribution >= 0).map((contribution) => readableFeature(contribution.feature));
  const mitigating = contributions.filter((contribution) => contribution.contribution < 0).map((contribution) => readableFeature(contribution.feature));
  const reasons = riskScore >= 0.5 ? riskDrivers : mitigating;

  return {
    text:
      riskScore >= 0.5
        ? `Payment follow-up risk is higher because ${joinReasons(reasons.slice(0, 3))}.`
        : `Payment follow-up risk is lower because ${joinReasons(reasons.slice(0, 3))}.`,
    factors: contributions
  };
}
