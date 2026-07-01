import { buildDemandPredictionExamples, buildDemandTrainingExamples, type FirstPartyTrainingData } from "@/lib/intelligence/ml/features";
import { explainDemandPrediction } from "@/lib/intelligence/ml/explainability";
import {
  confidenceFromRegression,
  predictLinearValue,
  trainLinearRegressionModel,
  type FeatureExample,
  type ModelTrainingResult,
  type VectorModelArtifact
} from "@/lib/intelligence/ml/model-registry";
import { clamp, round, trainValidationSplit } from "@/lib/intelligence/ml/metrics";

export type DemandForecastPrediction = {
  modelType: "demand";
  entityType: "menu_item";
  entityId: string;
  predictionJson: {
    forecastDate: string;
    itemName: string;
    categoryName: string | null;
    predictedQuantity: number;
    predictedQuantityRaw: number;
  };
  confidence: number;
  explanationJson: {
    text: string;
    factors: ReturnType<typeof explainDemandPrediction>["factors"];
  };
  modelVersion?: string;
};

export function demandTrainingExamples(data: FirstPartyTrainingData) {
  return buildDemandTrainingExamples(data);
}

export function trainDemandForecastModel(examples: FeatureExample[]): ModelTrainingResult {
  const sorted = examples.slice().sort((first, second) => first.observedAt.getTime() - second.observedAt.getTime());
  const { trainRows, validationRows } = trainValidationSplit(sorted, 0.2);

  return trainLinearRegressionModel({
    modelType: "demand",
    trainExamples: trainRows,
    validationExamples: validationRows,
    algorithm: "regularized_linear_regression_gradient_descent",
    learningRate: 0.035,
    iterations: 340,
    l2: 0.002
  });
}

export function predictDemandForecasts({
  artifact,
  data,
  modelVersion
}: {
  artifact: VectorModelArtifact;
  data: FirstPartyTrainingData;
  modelVersion?: string;
}): DemandForecastPrediction[] {
  return buildDemandPredictionExamples(data)
    .map((example) => {
      const rawPrediction = Math.max(0, predictLinearValue(artifact, example.features));
      const predictedQuantity = Math.max(0, Math.round(rawPrediction));
      const itemName = String(example.metadata.itemName ?? "Menu item");
      const explanation = explainDemandPrediction({ artifact, features: example.features, itemName });

      return {
        modelType: "demand" as const,
        entityType: "menu_item" as const,
        entityId: example.entityId,
        predictionJson: {
          forecastDate: String(example.metadata.forecastDate ?? example.observedAt.toISOString().slice(0, 10)),
          itemName,
          categoryName: typeof example.metadata.categoryName === "string" ? example.metadata.categoryName : null,
          predictedQuantity,
          predictedQuantityRaw: round(rawPrediction, 3)
        },
        confidence: clamp(confidenceFromRegression(artifact, rawPrediction, example.features), 0, 1),
        explanationJson: explanation,
        modelVersion
      };
    })
    .filter((prediction) => prediction.predictionJson.predictedQuantity > 0 || prediction.confidence >= 0.45)
    .sort((first, second) => second.predictionJson.predictedQuantity - first.predictionJson.predictedQuantity || second.confidence - first.confidence)
    .slice(0, 24);
}
