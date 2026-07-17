import type { ClassificationMetrics, RegressionMetrics } from "@/lib/intelligence/ml/metrics";
import { calculateClassificationMetrics, calculateRegressionMetrics, clamp, dot, round, sigmoid } from "@/lib/intelligence/ml/metrics";

export const intelligenceModelTypes = ["demand", "retention", "payment_risk"] as const;
export type IntelligenceModelType = (typeof intelligenceModelTypes)[number];

export const intelligenceFeatureSchemaVersions: Record<IntelligenceModelType, number> = {
  demand: 2,
  retention: 2,
  payment_risk: 2
};

export const intelligenceModelStatuses = ["needs_data", "ready_for_training", "training", "trained", "failed", "disabled"] as const;
export type IntelligenceModelStatus = (typeof intelligenceModelStatuses)[number];

export type IntelligenceEngineType = "rules_engine" | "trained_ml" | "hybrid_rules_plus_ml";

export type FeatureMap = Record<string, number>;

export type FeatureExample = {
  entityId: string;
  entityType: string;
  label?: number;
  features: FeatureMap;
  observedAt: Date;
  metadata: Record<string, string | number | boolean | null>;
};

export type VectorModelArtifact = {
  modelType: IntelligenceModelType;
  featureSchemaVersion: number;
  algorithm: string;
  featureNames: string[];
  means: number[];
  stds: number[];
  weights: number[];
  intercept: number;
  targetMean?: number;
  targetStd?: number;
  trainedAt: string;
  trainingRows: number;
  validationRows: number;
  metrics: RegressionMetrics | ClassificationMetrics;
};

export type ModelTrainingResult = {
  artifact: VectorModelArtifact;
  metrics: RegressionMetrics | ClassificationMetrics;
  trainRows: number;
  validationRows: number;
  rowsUsed: number;
};

export type ModelReadinessGate = {
  id: string;
  label: string;
  met: boolean;
  actual: number;
  required: number;
  unit: string;
  missing: number;
};

export type ModelReadiness = {
  modelType: IntelligenceModelType;
  status: IntelligenceModelStatus;
  rowsAvailable: number;
  trainingDataStart: Date | null;
  trainingDataEnd: Date | null;
  gates: ModelReadinessGate[];
  missingRequirements: string[];
};

export type PersistedModelStatus = ModelReadiness & {
  latestVersion: string | null;
  latestAlgorithm: string | null;
  lastTrainedAt: string | null;
  latestTrainingRows: number | null;
  latestValidationRows: number | null;
  latestMetrics: RegressionMetrics | ClassificationMetrics | Record<string, unknown> | null;
  latestRunStatus: IntelligenceModelStatus | null;
  latestRunStartedAt: string | null;
  latestRunCompletedAt: string | null;
  latestRunError: string | null;
};

export type IntelligenceEngineSummary = {
  type: IntelligenceEngineType;
  dataSource: "first_party_database";
  externalDatasets: "isolated_evaluation_only";
  syntheticProductionData: "none";
  trainedModelInUse: boolean;
  modelStatuses: Array<{
    modelType: IntelligenceModelType;
    status: IntelligenceModelStatus;
    latestVersion: string | null;
    lastTrainedAt: string | null;
    trainingRows: number | null;
    validationRows: number | null;
    metrics: PersistedModelStatus["latestMetrics"];
    missingRequirements: string[];
  }>;
};

export const modelLabels: Record<IntelligenceModelType, string> = {
  demand: "Demand forecasting",
  retention: "Customer retention",
  payment_risk: "Payment risk"
};

export function isIntelligenceModelType(value: unknown): value is IntelligenceModelType {
  return typeof value === "string" && intelligenceModelTypes.includes(value as IntelligenceModelType);
}

export function isCompatibleModelArtifact(value: unknown, modelType: IntelligenceModelType): value is VectorModelArtifact {
  if (!value || typeof value !== "object") return false;
  const artifact = value as Partial<VectorModelArtifact>;
  return artifact.modelType === modelType && artifact.featureSchemaVersion === intelligenceFeatureSchemaVersions[modelType];
}

export function modelTypesForRequest(value: unknown): IntelligenceModelType[] | null {
  if (value === undefined || value === null || value === "" || value === "all") return [...intelligenceModelTypes];
  return isIntelligenceModelType(value) ? [value] : null;
}

export function stableHash(value: string | null | undefined) {
  const input = (value ?? "unknown").trim().toLowerCase();
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `h${(hash >>> 0).toString(36)}`;
}

export function buildEngineSummary(statuses: PersistedModelStatus[]): IntelligenceEngineSummary {
  const trainedCount = statuses.filter((status) => status.status === "trained").length;
  const type: IntelligenceEngineType =
    trainedCount === 0 ? "rules_engine" : trainedCount === intelligenceModelTypes.length ? "trained_ml" : "hybrid_rules_plus_ml";

  return {
    type,
    dataSource: "first_party_database",
    externalDatasets: "isolated_evaluation_only",
    syntheticProductionData: "none",
    trainedModelInUse: trainedCount > 0,
    modelStatuses: statuses.map((status) => ({
      modelType: status.modelType,
      status: status.status,
      latestVersion: status.latestVersion,
      lastTrainedAt: status.lastTrainedAt,
      trainingRows: status.latestTrainingRows,
      validationRows: status.latestValidationRows,
      metrics: status.latestMetrics,
      missingRequirements: status.missingRequirements
    }))
  };
}

export function vectorizeFeatureMap(features: FeatureMap, artifact: Pick<VectorModelArtifact, "featureNames" | "means" | "stds">) {
  return artifact.featureNames.map((featureName, index) => {
    const raw = features[featureName] ?? 0;
    const std = artifact.stds[index] || 1;
    return (raw - (artifact.means[index] ?? 0)) / std;
  });
}

export function predictLinearValue(artifact: VectorModelArtifact, features: FeatureMap) {
  const normalized = vectorizeFeatureMap(features, artifact);
  const scaled = artifact.intercept + dot(artifact.weights, normalized);
  return scaled * (artifact.targetStd || 1) + (artifact.targetMean || 0);
}

export function predictLogisticProbability(artifact: VectorModelArtifact, features: FeatureMap) {
  const normalized = vectorizeFeatureMap(features, artifact);
  return sigmoid(artifact.intercept + dot(artifact.weights, normalized));
}

export function featureCoverage(artifact: VectorModelArtifact, features: FeatureMap) {
  if (!artifact.featureNames.length) return 0;
  const present = artifact.featureNames.filter((featureName) => Math.abs(features[featureName] ?? 0) > 0.000001).length;
  return present / artifact.featureNames.length;
}

function featureNamesFromExamples(examples: FeatureExample[]) {
  const names = new Set<string>();
  examples.forEach((example) => {
    Object.keys(example.features).forEach((name) => names.add(name));
  });

  return Array.from(names).sort();
}

function buildStandardization(examples: FeatureExample[], featureNames: string[]) {
  const means = featureNames.map((name) => {
    const sum = examples.reduce((total, example) => total + (example.features[name] ?? 0), 0);
    return sum / Math.max(1, examples.length);
  });
  const stds = featureNames.map((name, index) => {
    const mean = means[index] ?? 0;
    const variance =
      examples.reduce((total, example) => {
        const delta = (example.features[name] ?? 0) - mean;
        return total + delta * delta;
      }, 0) / Math.max(1, examples.length);
    const std = Math.sqrt(variance);
    return std > 0.000001 ? std : 1;
  });

  return { means, stds };
}

function labelsFromExamples(examples: FeatureExample[]) {
  return examples.map((example) => example.label ?? 0);
}

function vectorizeExamples(examples: FeatureExample[], artifact: Pick<VectorModelArtifact, "featureNames" | "means" | "stds">) {
  return examples.map((example) => vectorizeFeatureMap(example.features, artifact));
}

function initializeWeights(size: number) {
  return Array.from({ length: size }, () => 0);
}

export function trainLinearRegressionModel({
  modelType,
  trainExamples,
  validationExamples,
  algorithm,
  learningRate = 0.035,
  iterations = 320,
  l2 = 0.002
}: {
  modelType: IntelligenceModelType;
  trainExamples: FeatureExample[];
  validationExamples: FeatureExample[];
  algorithm: string;
  learningRate?: number;
  iterations?: number;
  l2?: number;
}): ModelTrainingResult {
  if (trainExamples.length < 2) {
    throw new Error(`${modelLabels[modelType]} needs at least 2 training examples after the validation split.`);
  }

  const featureNames = featureNamesFromExamples(trainExamples);
  const { means, stds } = buildStandardization(trainExamples, featureNames);
  const baseArtifact = { featureNames, means, stds };
  const x = vectorizeExamples(trainExamples, baseArtifact);
  const labels = labelsFromExamples(trainExamples);
  const targetMean = labels.reduce((sum, label) => sum + label, 0) / Math.max(1, labels.length);
  const targetVariance = labels.reduce((sum, label) => sum + (label - targetMean) * (label - targetMean), 0) / Math.max(1, labels.length);
  const targetStd = Math.sqrt(targetVariance) > 0.000001 ? Math.sqrt(targetVariance) : 1;
  const y = labels.map((label) => (label - targetMean) / targetStd);
  const weights = initializeWeights(featureNames.length);
  let intercept = 0;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const gradient = initializeWeights(weights.length);
    let interceptGradient = 0;

    for (let row = 0; row < x.length; row += 1) {
      const prediction = intercept + dot(weights, x[row] ?? []);
      const error = prediction - (y[row] ?? 0);
      interceptGradient += error;
      for (let column = 0; column < weights.length; column += 1) {
        gradient[column] = (gradient[column] ?? 0) + error * ((x[row] ?? [])[column] ?? 0);
      }
    }

    const scale = 1 / Math.max(1, x.length);
    intercept -= learningRate * interceptGradient * scale;
    for (let column = 0; column < weights.length; column += 1) {
      const penalty = l2 * (weights[column] ?? 0);
      weights[column] = (weights[column] ?? 0) - learningRate * ((gradient[column] ?? 0) * scale + penalty);
    }
  }

  const artifact: VectorModelArtifact = {
    modelType,
    featureSchemaVersion: intelligenceFeatureSchemaVersions[modelType],
    algorithm,
    featureNames,
    means,
    stds,
    weights: weights.map((weight) => round(weight, 8)),
    intercept: round(intercept, 8),
    targetMean: round(targetMean, 8),
    targetStd: round(targetStd, 8),
    trainedAt: new Date().toISOString(),
    trainingRows: trainExamples.length,
    validationRows: validationExamples.length,
    metrics: { mae: 0, rmse: 0, mape: null, evaluatedRows: 0 }
  };

  const validationPredictions = validationExamples.map((example) => Math.max(0, predictLinearValue(artifact, example.features)));
  const validationLabels = labelsFromExamples(validationExamples);
  const metrics = calculateRegressionMetrics(validationPredictions, validationLabels);
  artifact.metrics = metrics;

  return {
    artifact,
    metrics,
    trainRows: trainExamples.length,
    validationRows: validationExamples.length,
    rowsUsed: trainExamples.length + validationExamples.length
  };
}

export function trainLogisticRegressionModel({
  modelType,
  trainExamples,
  validationExamples,
  algorithm,
  learningRate = 0.045,
  iterations = 420,
  l2 = 0.003
}: {
  modelType: IntelligenceModelType;
  trainExamples: FeatureExample[];
  validationExamples: FeatureExample[];
  algorithm: string;
  learningRate?: number;
  iterations?: number;
  l2?: number;
}): ModelTrainingResult {
  if (trainExamples.length < 2) {
    throw new Error(`${modelLabels[modelType]} needs at least 2 training examples after the validation split.`);
  }

  const featureNames = featureNamesFromExamples(trainExamples);
  const { means, stds } = buildStandardization(trainExamples, featureNames);
  const baseArtifact = { featureNames, means, stds };
  const x = vectorizeExamples(trainExamples, baseArtifact);
  const y = labelsFromExamples(trainExamples).map((label) => (label >= 0.5 ? 1 : 0));
  const weights = initializeWeights(featureNames.length);
  let intercept = 0;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const gradient = initializeWeights(weights.length);
    let interceptGradient = 0;

    for (let row = 0; row < x.length; row += 1) {
      const probability = sigmoid(intercept + dot(weights, x[row] ?? []));
      const error = probability - (y[row] ?? 0);
      interceptGradient += error;
      for (let column = 0; column < weights.length; column += 1) {
        gradient[column] = (gradient[column] ?? 0) + error * ((x[row] ?? [])[column] ?? 0);
      }
    }

    const scale = 1 / Math.max(1, x.length);
    intercept -= learningRate * interceptGradient * scale;
    for (let column = 0; column < weights.length; column += 1) {
      const penalty = l2 * (weights[column] ?? 0);
      weights[column] = (weights[column] ?? 0) - learningRate * ((gradient[column] ?? 0) * scale + penalty);
    }
  }

  const artifact: VectorModelArtifact = {
    modelType,
    featureSchemaVersion: intelligenceFeatureSchemaVersions[modelType],
    algorithm,
    featureNames,
    means,
    stds,
    weights: weights.map((weight) => round(weight, 8)),
    intercept: round(intercept, 8),
    trainedAt: new Date().toISOString(),
    trainingRows: trainExamples.length,
    validationRows: validationExamples.length,
    metrics: {
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1: 0,
      auc: null,
      threshold: 0.5,
      evaluatedRows: 0,
      positiveRows: 0,
      negativeRows: 0
    }
  };

  const validationProbabilities = validationExamples.map((example) => predictLogisticProbability(artifact, example.features));
  const validationLabels = labelsFromExamples(validationExamples);
  const metrics = calculateClassificationMetrics(validationProbabilities, validationLabels);
  artifact.metrics = metrics;

  return {
    artifact,
    metrics,
    trainRows: trainExamples.length,
    validationRows: validationExamples.length,
    rowsUsed: trainExamples.length + validationExamples.length
  };
}

export function confidenceFromRegression(artifact: VectorModelArtifact, prediction: number, features: FeatureMap) {
  const metrics = artifact.metrics as RegressionMetrics;
  const baseline = Math.max(1, artifact.targetMean ?? prediction);
  const errorRatio = metrics.rmse ? metrics.rmse / baseline : 1;
  const quality = clamp(1 / (1 + errorRatio), 0.15, 0.95);
  const nonZeroCoverage = clamp(featureCoverage(artifact, features) * 4, 0.25, 1);
  return round(clamp(quality * nonZeroCoverage, 0.1, 0.95));
}

export function confidenceFromClassification(artifact: VectorModelArtifact, probability: number, features: FeatureMap) {
  const metrics = artifact.metrics as ClassificationMetrics;
  const separation = Math.abs(probability - 0.5) * 2;
  const validationQuality = metrics.f1 || metrics.accuracy || 0.4;
  const nonZeroCoverage = clamp(featureCoverage(artifact, features) * 4, 0.25, 1);
  return round(clamp((separation * 0.55 + validationQuality * 0.45) * nonZeroCoverage, 0.1, 0.97));
}
