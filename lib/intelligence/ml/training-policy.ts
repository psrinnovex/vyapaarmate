import {
  boundedChronologicalRows,
  chronologicalEvaluationSplit
} from "@/lib/intelligence/ml/metrics";
import type { FeatureExample, IntelligenceModelType } from "@/lib/intelligence/ml/model-registry";

function boundedEnvironmentNumber(name: string, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
}

export function intelligenceTrainingBounds(modelType: IntelligenceModelType) {
  const defaultMaximumTrainRows = modelType === "retention" ? 30_000 : 50_000;
  return {
    maximumTrainRows: boundedEnvironmentNumber("INTELLIGENCE_ML_MAX_TRAIN_ROWS", defaultMaximumTrainRows, 1_000, 75_000),
    maximumValidationRows: boundedEnvironmentNumber("INTELLIGENCE_ML_MAX_VALIDATION_ROWS", 10_000, 100, 20_000),
    maximumFeatures: boundedEnvironmentNumber("INTELLIGENCE_ML_MAX_FEATURES", 512, 32, 1_024),
    batchSize: boundedEnvironmentNumber("INTELLIGENCE_ML_BATCH_SIZE", 8_192, 256, 16_384),
    maximumTrainingMs: boundedEnvironmentNumber("INTELLIGENCE_ML_MAX_TRAINING_MS", 40_000, 5_000, 50_000)
  };
}

export function prepareChronologicalTraining(examples: FeatureExample[], modelType: IntelligenceModelType) {
  const minimumValidationRows = modelType === "demand" ? 30 : 50;
  const split = chronologicalEvaluationSplit(examples, {
    validationRatio: 0.2,
    minimumValidationRows
  });
  const bounds = intelligenceTrainingBounds(modelType);
  const trainExamples = boundedChronologicalRows(split.trainRows, bounds.maximumTrainRows);
  const validationExamples = boundedChronologicalRows(split.validationRows, bounds.maximumValidationRows);

  return {
    trainExamples,
    validationExamples,
    split,
    bounds,
    runtime: {
      ...bounds,
      rowsConsidered: examples.length,
      embargoRows: split.embargoRows.length,
      validationStart: split.validationStart
    }
  };
}
