import { buildRetentionPredictionExamples, buildRetentionTrainingExamples, type FirstPartyTrainingData } from "@/lib/intelligence/ml/features";
import { explainRetentionPrediction } from "@/lib/intelligence/ml/explainability";
import {
  confidenceFromClassification,
  predictLogisticProbability,
  trainLogisticRegressionModel,
  type FeatureExample,
  type ModelTrainingResult,
  type VectorModelArtifact
} from "@/lib/intelligence/ml/model-registry";
import { clamp, round, trainValidationSplit } from "@/lib/intelligence/ml/metrics";

export type RetentionPrediction = {
  modelType: "retention";
  entityType: "customer";
  entityId: string;
  predictionJson: {
    customerName: string;
    repeatLikelihood: number;
    inactiveRisk: number;
    daysSinceLastOrder: number | null;
    totalOrders: number | null;
  };
  confidence: number;
  explanationJson: {
    text: string;
    factors: ReturnType<typeof explainRetentionPrediction>["factors"];
  };
  modelVersion?: string;
};

export function retentionTrainingExamples(data: FirstPartyTrainingData) {
  return buildRetentionTrainingExamples(data);
}

export function trainRetentionModel(examples: FeatureExample[]): ModelTrainingResult {
  const sorted = examples.slice().sort((first, second) => first.observedAt.getTime() - second.observedAt.getTime());
  const { trainRows, validationRows } = trainValidationSplit(sorted, 0.2);

  return trainLogisticRegressionModel({
    modelType: "retention",
    trainExamples: trainRows,
    validationExamples: validationRows,
    algorithm: "regularized_logistic_regression_gradient_descent",
    learningRate: 0.045,
    iterations: 440,
    l2: 0.003
  });
}

export function predictRetention({
  artifact,
  data,
  modelVersion
}: {
  artifact: VectorModelArtifact;
  data: FirstPartyTrainingData;
  modelVersion?: string;
}): RetentionPrediction[] {
  return buildRetentionPredictionExamples(data)
    .map((example) => {
      const repeatLikelihood = clamp(predictLogisticProbability(artifact, example.features), 0, 1);
      const inactiveRisk = clamp(1 - repeatLikelihood, 0, 1);
      const customerName = String(example.metadata.customerName ?? "Customer");
      const explanation = explainRetentionPrediction({
        artifact,
        features: example.features,
        customerName,
        repeatLikelihood
      });

      return {
        modelType: "retention" as const,
        entityType: "customer" as const,
        entityId: example.entityId,
        predictionJson: {
          customerName,
          repeatLikelihood: round(repeatLikelihood, 4),
          inactiveRisk: round(inactiveRisk, 4),
          daysSinceLastOrder: typeof example.metadata.daysSinceLastOrder === "number" ? example.metadata.daysSinceLastOrder : null,
          totalOrders: typeof example.metadata.totalOrders === "number" ? example.metadata.totalOrders : null
        },
        confidence: clamp(confidenceFromClassification(artifact, repeatLikelihood, example.features), 0, 1),
        explanationJson: explanation,
        modelVersion
      };
    })
    .sort((first, second) => second.predictionJson.inactiveRisk - first.predictionJson.inactiveRisk || second.confidence - first.confidence)
    .slice(0, 50);
}
