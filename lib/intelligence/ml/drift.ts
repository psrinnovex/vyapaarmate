import { clamp, round } from "@/lib/intelligence/ml/metrics";
import type { FeatureExample, VectorModelArtifact } from "@/lib/intelligence/ml/model-registry";

const naturallyCyclicalFeatures = new Set(["dayOfWeek", "isWeekend", "weekOfMonth", "month"]);

export type IntelligenceDriftStatus = "insufficient_data" | "stable" | "warning" | "critical";

export type IntelligenceDriftAssessment = {
  status: IntelligenceDriftStatus;
  score: number | null;
  checkedRows: number;
  consecutiveCritical: number;
  shouldRollback: boolean;
  featureDrift: Array<{
    feature: string;
    referenceMean: number;
    currentMean: number;
    standardizedShift: number;
  }>;
  checkedAt: string;
};

export function assessModelDrift({
  artifact,
  examples,
  previousConsecutiveCritical = 0,
  warningThreshold = 0.35,
  criticalThreshold = 0.65
}: {
  artifact: VectorModelArtifact;
  examples: FeatureExample[];
  previousConsecutiveCritical?: number;
  warningThreshold?: number;
  criticalThreshold?: number;
}): IntelligenceDriftAssessment {
  const checkedAt = new Date().toISOString();
  if (examples.length < 10 || !artifact.featureNames.length) {
    return {
      status: "insufficient_data",
      score: null,
      checkedRows: examples.length,
      consecutiveCritical: 0,
      shouldRollback: false,
      featureDrift: [],
      checkedAt
    };
  }

  const indexes = new Map(artifact.featureNames.map((name, index) => [name, index]));
  const sums = new Float64Array(artifact.featureNames.length);
  examples.forEach((example) => {
    Object.entries(example.features).forEach(([name, value]) => {
      const index = indexes.get(name);
      if (index !== undefined) sums[index] += value;
    });
  });

  const shifts = artifact.featureNames
    .filter((feature) => !naturallyCyclicalFeatures.has(feature))
    .map((feature) => {
      const artifactIndex = artifact.featureNames.indexOf(feature);
      const referenceMean = artifact.referenceMeans?.[artifactIndex] ?? artifact.means[artifactIndex] ?? 0;
      const referenceStd = artifact.referenceStds?.[artifactIndex] ?? artifact.stds[artifactIndex] ?? 1;
      const currentMean = sums[artifactIndex]! / examples.length;
      const standardizedShift = Math.abs(currentMean - referenceMean) / Math.max(0.05, referenceStd);
      return {
        feature,
        referenceMean,
        currentMean,
        standardizedShift
      };
    })
    .filter((row) => Math.abs(row.referenceMean) >= 0.005 || Math.abs(row.currentMean) >= 0.005)
    .sort((first, second) => second.standardizedShift - first.standardizedShift);
  const strongest = shifts.slice(0, Math.min(20, shifts.length));
  const averageShift = strongest.length
    ? strongest.reduce((sum, row) => sum + Math.min(5, row.standardizedShift), 0) / strongest.length
    : 0;
  const score = round(clamp(1 - Math.exp(-averageShift / 3), 0, 1), 6);
  const status: IntelligenceDriftStatus = score >= criticalThreshold ? "critical" : score >= warningThreshold ? "warning" : "stable";
  const consecutiveCritical = status === "critical" ? previousConsecutiveCritical + 1 : 0;

  return {
    status,
    score,
    checkedRows: examples.length,
    consecutiveCritical,
    shouldRollback: consecutiveCritical >= 2,
    featureDrift: strongest.map((row) => ({
      feature: row.feature,
      referenceMean: round(row.referenceMean, 6),
      currentMean: round(row.currentMean, 6),
      standardizedShift: round(row.standardizedShift, 6)
    })),
    checkedAt
  };
}
