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
import { clamp, round } from "@/lib/intelligence/ml/metrics";
import { prepareChronologicalTraining } from "@/lib/intelligence/ml/training-policy";

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
  const prepared = prepareChronologicalTraining(examples, "retention");

  return trainLogisticRegressionModel({
    modelType: "retention",
    trainExamples: prepared.trainExamples,
    validationExamples: prepared.validationExamples,
    algorithm: "calibrated_regularized_logistic_regression_sparse_minibatch",
    learningRate: 0.045,
    iterations: 220,
    l2: 0.003,
    runtime: prepared.runtime
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
