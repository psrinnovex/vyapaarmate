import type {
  ClassificationMetrics,
  ModelEvaluation,
  ProbabilityCalibration,
  RegressionMetrics
} from "@/lib/intelligence/ml/metrics";
import {
  applyProbabilityCalibration,
  calculateClassificationMetrics,
  calculateRegressionMetrics,
  clamp,
  classificationPromotionDecision,
  dot,
  fitPlattCalibration,
  regressionPromotionDecision,
  round,
  selectClassificationThreshold,
  sigmoid,
  sparseDot
} from "@/lib/intelligence/ml/metrics";

export const intelligenceModelTypes = ["demand", "retention", "payment_risk"] as const;
export type IntelligenceModelType = (typeof intelligenceModelTypes)[number];

export const intelligenceFeatureSchemaVersions: Record<IntelligenceModelType, number> = {
  demand: 3,
  retention: 3,
  payment_risk: 3
};

export const intelligenceModelStatuses = ["needs_data", "ready_for_training", "training", "shadow", "trained", "failed", "disabled"] as const;
export type IntelligenceModelStatus = (typeof intelligenceModelStatuses)[number];

export const intelligenceArtifactLifecycleStatuses = ["shadow", "active", "retired", "rolled_back"] as const;
export type IntelligenceArtifactLifecycleStatus = (typeof intelligenceArtifactLifecycleStatuses)[number];

export type IntelligenceEngineType = "rules_engine" | "trained_ml" | "hybrid_rules_plus_ml";

export type FeatureMap = Record<string, number>;

export type FeatureExample = {
  entityId: string;
  entityType: string;
  label?: number;
  labelAvailableAt?: Date;
  baselinePrediction?: number;
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
  decisionThreshold?: number;
  calibration?: ProbabilityCalibration;
  referenceMeans?: number[];
  referenceStds?: number[];
  evaluation?: ModelEvaluation;
  trainingBounds?: {
    rowsConsidered: number;
    rowsUsed: number;
    maximumTrainRows: number;
    maximumValidationRows: number;
    maximumFeatures: number;
    batchSize: number;
    iterationsCompleted: number;
    bounded: boolean;
  };
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
  rowsConsidered: number;
  embargoRows: number;
  iterationsCompleted: number;
  bounded: boolean;
  evaluation: ModelEvaluation;
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
  lifecycleStatus: IntelligenceArtifactLifecycleStatus | null;
  promotionEligible: boolean;
  baselineMetrics: RegressionMetrics | ClassificationMetrics | Record<string, unknown> | null;
  evaluation: ModelEvaluation | Record<string, unknown> | null;
  driftStatus: string | null;
  driftScore: number | null;
  lastDriftCheckedAt: string | null;
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
    lifecycleStatus: PersistedModelStatus["lifecycleStatus"];
    promotionEligible: boolean;
    driftStatus: string | null;
    driftScore: number | null;
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
  const featureCount = artifact.featureNames?.length ?? -1;
  return (
    artifact.modelType === modelType &&
    artifact.featureSchemaVersion === intelligenceFeatureSchemaVersions[modelType] &&
    typeof artifact.algorithm === "string" &&
    Array.isArray(artifact.featureNames) &&
    artifact.featureNames.every((name) => typeof name === "string") &&
    Array.isArray(artifact.means) &&
    artifact.means.length === featureCount &&
    artifact.means.every(Number.isFinite) &&
    Array.isArray(artifact.stds) &&
    artifact.stds.length === featureCount &&
    artifact.stds.every((value) => Number.isFinite(value) && value > 0) &&
    Array.isArray(artifact.weights) &&
    artifact.weights.length === featureCount &&
    artifact.weights.every(Number.isFinite) &&
    typeof artifact.intercept === "number" &&
    Number.isFinite(artifact.intercept)
  );
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
      lifecycleStatus: status.lifecycleStatus,
      promotionEligible: status.promotionEligible,
      driftStatus: status.driftStatus,
      driftScore: status.driftScore,
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

export function predictRawLogisticProbability(artifact: VectorModelArtifact, features: FeatureMap) {
  const normalized = vectorizeFeatureMap(features, artifact);
  return sigmoid(artifact.intercept + dot(artifact.weights, normalized));
}

export function predictLogisticProbability(artifact: VectorModelArtifact, features: FeatureMap) {
  return applyProbabilityCalibration(predictRawLogisticProbability(artifact, features), artifact.calibration);
}

export function featureCoverage(artifact: VectorModelArtifact, features: FeatureMap) {
  if (!artifact.featureNames.length) return 0;
  const present = artifact.featureNames.filter((featureName) => Math.abs(features[featureName] ?? 0) > 0.000001).length;
  return present / artifact.featureNames.length;
}

function featureNamesFromExamples(examples: FeatureExample[], maximumFeatures: number) {
  const frequencies = new Map<string, number>();
  examples.forEach((example) => {
    Object.keys(example.features).forEach((name) => frequencies.set(name, (frequencies.get(name) ?? 0) + 1));
  });

  const numeric = Array.from(frequencies.keys()).filter((name) => !name.includes(":")).sort();
  const categorical = Array.from(frequencies.keys())
    .filter((name) => name.includes(":"))
    .sort((first, second) => (frequencies.get(second) ?? 0) - (frequencies.get(first) ?? 0) || first.localeCompare(second));
  return [...numeric, ...categorical].slice(0, Math.max(1, maximumFeatures));
}

function buildStandardization(examples: FeatureExample[], featureNames: string[]) {
  const indexes = new Map(featureNames.map((name, index) => [name, index]));
  const sums = new Float64Array(featureNames.length);
  const squares = new Float64Array(featureNames.length);
  examples.forEach((example) => {
    Object.entries(example.features).forEach(([name, value]) => {
      const index = indexes.get(name);
      if (index === undefined) return;
      sums[index] += value;
      squares[index] += value * value;
    });
  });

  const divisor = Math.max(1, examples.length);
  const referenceMeans = featureNames.map((_, index) => sums[index]! / divisor);
  const referenceStds = featureNames.map((_, index) => {
    const mean = referenceMeans[index] ?? 0;
    const variance = Math.max(0, squares[index]! / divisor - mean * mean);
    const std = Math.sqrt(variance);
    return std > 0.000001 ? std : 1;
  });
  const means = featureNames.map((name, index) => (name.includes(":") ? 0 : referenceMeans[index] ?? 0));
  const stds = featureNames.map((name, index) => (name.includes(":") ? 1 : referenceStds[index] ?? 1));

  return { means, stds, referenceMeans, referenceStds };
}

function labelsFromExamples(examples: FeatureExample[]) {
  return examples.map((example) => example.label ?? 0);
}

function sparseExamples(
  examples: FeatureExample[],
  artifact: Pick<VectorModelArtifact, "featureNames" | "means" | "stds">
) {
  const indexes = new Map(artifact.featureNames.map((name, index) => [name, index]));
  const denseIndexes = artifact.featureNames
    .map((name, index) => ({ name, index }))
    .filter(({ name }) => !name.includes(":"));

  return examples.map((example) => {
    const row: Array<readonly [number, number]> = denseIndexes.map(({ name, index }) => {
      const value = ((example.features[name] ?? 0) - (artifact.means[index] ?? 0)) / (artifact.stds[index] || 1);
      return [index, value] as const;
    });
    Object.entries(example.features).forEach(([name, value]) => {
      if (!name.includes(":")) return;
      const index = indexes.get(name);
      if (index === undefined || Math.abs(value) <= 0.000001) return;
      row.push([index, value / (artifact.stds[index] || 1)] as const);
    });
    return row;
  });
}

type TrainingRuntimeOptions = {
  rowsConsidered?: number;
  embargoRows?: number;
  validationStart?: Date | null;
  maximumTrainRows?: number;
  maximumValidationRows?: number;
  maximumFeatures?: number;
  batchSize?: number;
  maximumTrainingMs?: number;
};

export function trainLinearRegressionModel({
  modelType,
  trainExamples,
  validationExamples,
  algorithm,
  learningRate = 0.035,
  iterations = 180,
  l2 = 0.002,
  baselinePredictions,
  runtime = {}
}: {
  modelType: IntelligenceModelType;
  trainExamples: FeatureExample[];
  validationExamples: FeatureExample[];
  algorithm: string;
  learningRate?: number;
  iterations?: number;
  l2?: number;
  baselinePredictions?: number[];
  runtime?: TrainingRuntimeOptions;
}): ModelTrainingResult {
  if (trainExamples.length < 2) {
    throw new Error(`${modelLabels[modelType]} needs at least 2 training examples after the validation split.`);
  }

  const maximumFeatures = runtime.maximumFeatures ?? 512;
  const batchSize = Math.max(64, Math.min(runtime.batchSize ?? 8192, trainExamples.length));
  const deadlineAt = Date.now() + Math.max(1_000, runtime.maximumTrainingMs ?? 45_000);
  const featureNames = featureNamesFromExamples(trainExamples, maximumFeatures);
  const { means, stds, referenceMeans, referenceStds } = buildStandardization(trainExamples, featureNames);
  const baseArtifact = { featureNames, means, stds };
  const x = sparseExamples(trainExamples, baseArtifact);
  const labels = labelsFromExamples(trainExamples);
  const targetMean = labels.reduce((sum, label) => sum + label, 0) / Math.max(1, labels.length);
  const targetVariance = labels.reduce((sum, label) => sum + (label - targetMean) * (label - targetMean), 0) / Math.max(1, labels.length);
  const targetStd = Math.sqrt(targetVariance) > 0.000001 ? Math.sqrt(targetVariance) : 1;
  const y = labels.map((label) => (label - targetMean) / targetStd);
  const weights = new Float64Array(featureNames.length);
  let intercept = 0;
  let iterationsCompleted = 0;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const gradient = new Float64Array(weights.length);
    let interceptGradient = 0;
    const batchStart = (iteration * batchSize) % x.length;

    for (let offset = 0; offset < batchSize; offset += 1) {
      const row = (batchStart + offset) % x.length;
      const sparseRow = x[row] ?? [];
      const prediction = intercept + sparseDot(weights, sparseRow);
      const error = prediction - (y[row] ?? 0);
      interceptGradient += error;
      sparseRow.forEach(([column, value]) => { gradient[column] += error * value; });
    }

    const scale = 1 / batchSize;
    intercept -= learningRate * interceptGradient * scale;
    for (let column = 0; column < weights.length; column += 1) {
      const penalty = l2 * weights[column]!;
      weights[column] -= learningRate * (gradient[column]! * scale + penalty);
    }
    iterationsCompleted = iteration + 1;
    if (iterationsCompleted >= 20 && iterationsCompleted % 5 === 0 && Date.now() >= deadlineAt) break;
  }

  const artifact: VectorModelArtifact = {
    modelType,
    featureSchemaVersion: intelligenceFeatureSchemaVersions[modelType],
    algorithm,
    featureNames,
    means,
    stds,
    referenceMeans,
    referenceStds,
    weights: Array.from(weights, (weight) => round(weight, 8)),
    intercept: round(intercept, 8),
    targetMean: round(targetMean, 8),
    targetStd: round(targetStd, 8),
    trainedAt: new Date().toISOString(),
    trainingRows: trainExamples.length,
    validationRows: validationExamples.length,
    metrics: { mae: 0, rmse: 0, mape: null, wape: null, evaluatedRows: 0 }
  };

  const validationPredictions = validationExamples.map((example) => Math.max(0, predictLinearValue(artifact, example.features)));
  const validationLabels = labelsFromExamples(validationExamples);
  const metrics = calculateRegressionMetrics(validationPredictions, validationLabels);
  const baselineMetrics = calculateRegressionMetrics(
    baselinePredictions?.length === validationExamples.length
      ? baselinePredictions
      : validationExamples.map(() => targetMean),
    validationLabels
  );
  const promotion = regressionPromotionDecision(metrics, baselineMetrics);
  const rowsConsidered = runtime.rowsConsidered ?? trainExamples.length + validationExamples.length + (runtime.embargoRows ?? 0);
  const rowsUsed = trainExamples.length + validationExamples.length;
  const evaluation: ModelEvaluation = {
    split: {
      rowsConsidered,
      trainRows: trainExamples.length,
      validationRows: validationExamples.length,
      embargoRows: runtime.embargoRows ?? 0,
      validationStart: runtime.validationStart?.toISOString() ?? null
    },
    candidateMetrics: metrics,
    baselineMetrics,
    promotion
  };
  artifact.metrics = metrics;
  artifact.evaluation = evaluation;
  artifact.trainingBounds = {
    rowsConsidered,
    rowsUsed,
    maximumTrainRows: runtime.maximumTrainRows ?? trainExamples.length,
    maximumValidationRows: runtime.maximumValidationRows ?? validationExamples.length,
    maximumFeatures,
    batchSize,
    iterationsCompleted,
    bounded: rowsUsed < rowsConsidered || iterationsCompleted < iterations
  };

  return {
    artifact,
    metrics,
    trainRows: trainExamples.length,
    validationRows: validationExamples.length,
    rowsUsed,
    rowsConsidered,
    embargoRows: runtime.embargoRows ?? 0,
    iterationsCompleted,
    bounded: artifact.trainingBounds.bounded,
    evaluation
  };
}

export function trainLogisticRegressionModel({
  modelType,
  trainExamples,
  validationExamples,
  algorithm,
  learningRate = 0.045,
  iterations = 220,
  l2 = 0.003,
  runtime = {}
}: {
  modelType: IntelligenceModelType;
  trainExamples: FeatureExample[];
  validationExamples: FeatureExample[];
  algorithm: string;
  learningRate?: number;
  iterations?: number;
  l2?: number;
  runtime?: TrainingRuntimeOptions;
}): ModelTrainingResult {
  if (trainExamples.length < 2) {
    throw new Error(`${modelLabels[modelType]} needs at least 2 training examples after the validation split.`);
  }

  const maximumFeatures = runtime.maximumFeatures ?? 512;
  const batchSize = Math.max(64, Math.min(runtime.batchSize ?? 8192, trainExamples.length));
  const deadlineAt = Date.now() + Math.max(1_000, runtime.maximumTrainingMs ?? 45_000);
  const featureNames = featureNamesFromExamples(trainExamples, maximumFeatures);
  const { means, stds, referenceMeans, referenceStds } = buildStandardization(trainExamples, featureNames);
  const baseArtifact = { featureNames, means, stds };
  const x = sparseExamples(trainExamples, baseArtifact);
  const y = labelsFromExamples(trainExamples).map((label) => (label >= 0.5 ? 1 : 0));
  const positiveRows = y.filter(Boolean).length;
  const negativeRows = y.length - positiveRows;
  const positiveWeight = positiveRows ? y.length / (2 * positiveRows) : 1;
  const negativeWeight = negativeRows ? y.length / (2 * negativeRows) : 1;
  const weights = new Float64Array(featureNames.length);
  let intercept = 0;
  let iterationsCompleted = 0;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const gradient = new Float64Array(weights.length);
    let interceptGradient = 0;
    const batchStart = (iteration * batchSize) % x.length;

    for (let offset = 0; offset < batchSize; offset += 1) {
      const row = (batchStart + offset) % x.length;
      const sparseRow = x[row] ?? [];
      const probability = sigmoid(intercept + sparseDot(weights, sparseRow));
      const rowWeight = y[row] ? positiveWeight : negativeWeight;
      const error = (probability - (y[row] ?? 0)) * rowWeight;
      interceptGradient += error;
      sparseRow.forEach(([column, value]) => { gradient[column] += error * value; });
    }

    const scale = 1 / batchSize;
    intercept -= learningRate * interceptGradient * scale;
    for (let column = 0; column < weights.length; column += 1) {
      const penalty = l2 * weights[column]!;
      weights[column] -= learningRate * (gradient[column]! * scale + penalty);
    }
    iterationsCompleted = iteration + 1;
    if (iterationsCompleted >= 20 && iterationsCompleted % 5 === 0 && Date.now() >= deadlineAt) break;
  }

  const artifact: VectorModelArtifact = {
    modelType,
    featureSchemaVersion: intelligenceFeatureSchemaVersions[modelType],
    algorithm,
    featureNames,
    means,
    stds,
    referenceMeans,
    referenceStds,
    weights: Array.from(weights, (weight) => round(weight, 8)),
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
      prAuc: null,
      brierScore: 0,
      expectedCalibrationError: 0,
      threshold: 0.5,
      evaluatedRows: 0,
      positiveRows: 0,
      negativeRows: 0
    }
  };

  const rawTrainingProbabilities = trainExamples.map((example) => predictRawLogisticProbability(artifact, example.features));
  const calibration = fitPlattCalibration(rawTrainingProbabilities, y);
  artifact.calibration = calibration;
  const calibratedTrainingProbabilities = rawTrainingProbabilities.map((probability) => applyProbabilityCalibration(probability, calibration));
  const decisionThreshold = selectClassificationThreshold(calibratedTrainingProbabilities, y);
  artifact.decisionThreshold = decisionThreshold;
  const validationProbabilities = validationExamples.map((example) => predictLogisticProbability(artifact, example.features));
  const validationLabels = labelsFromExamples(validationExamples);
  const metrics = calculateClassificationMetrics(validationProbabilities, validationLabels, decisionThreshold);
  const prevalence = y.reduce<number>((sum, label) => sum + label, 0) / Math.max(1, y.length);
  const baselineMetrics = calculateClassificationMetrics(
    validationExamples.map(() => prevalence),
    validationLabels,
    0.5
  );
  const validationPrevalence = validationLabels.reduce((sum, label) => sum + (label ? 1 : 0), 0) / Math.max(1, validationLabels.length);
  baselineMetrics.prAuc = round(validationPrevalence);
  const promotion = classificationPromotionDecision(metrics, baselineMetrics);
  const rowsConsidered = runtime.rowsConsidered ?? trainExamples.length + validationExamples.length + (runtime.embargoRows ?? 0);
  const rowsUsed = trainExamples.length + validationExamples.length;
  const evaluation: ModelEvaluation = {
    split: {
      rowsConsidered,
      trainRows: trainExamples.length,
      validationRows: validationExamples.length,
      embargoRows: runtime.embargoRows ?? 0,
      validationStart: runtime.validationStart?.toISOString() ?? null
    },
    candidateMetrics: metrics,
    baselineMetrics,
    promotion,
    calibration
  };
  artifact.metrics = metrics;
  artifact.evaluation = evaluation;
  artifact.trainingBounds = {
    rowsConsidered,
    rowsUsed,
    maximumTrainRows: runtime.maximumTrainRows ?? trainExamples.length,
    maximumValidationRows: runtime.maximumValidationRows ?? validationExamples.length,
    maximumFeatures,
    batchSize,
    iterationsCompleted,
    bounded: rowsUsed < rowsConsidered || iterationsCompleted < iterations
  };

  return {
    artifact,
    metrics,
    trainRows: trainExamples.length,
    validationRows: validationExamples.length,
    rowsUsed,
    rowsConsidered,
    embargoRows: runtime.embargoRows ?? 0,
    iterationsCompleted,
    bounded: artifact.trainingBounds.bounded,
    evaluation
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
