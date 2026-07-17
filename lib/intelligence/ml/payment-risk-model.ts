import { buildPaymentRiskPredictionExamples, buildPaymentRiskTrainingExamples, type FirstPartyTrainingData } from "@/lib/intelligence/ml/features";
import { explainPaymentRiskPrediction } from "@/lib/intelligence/ml/explainability";
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

export type PaymentRiskPrediction = {
  modelType: "payment_risk";
  entityType: "payment";
  entityId: string;
  predictionJson: {
    orderId: string | null;
    customerId: string | null;
    amount: number;
    status: string;
    provider: string;
    followUpRisk: number;
  };
  confidence: number;
  explanationJson: {
    text: string;
    factors: ReturnType<typeof explainPaymentRiskPrediction>["factors"];
  };
  modelVersion?: string;
};

export function paymentRiskTrainingExamples(data: FirstPartyTrainingData) {
  return buildPaymentRiskTrainingExamples(data);
}

export function trainPaymentRiskModel(examples: FeatureExample[]): ModelTrainingResult {
  const prepared = prepareChronologicalTraining(examples, "payment_risk");

  return trainLogisticRegressionModel({
    modelType: "payment_risk",
    trainExamples: prepared.trainExamples,
    validationExamples: prepared.validationExamples,
    algorithm: "calibrated_regularized_logistic_regression_sparse_minibatch",
    learningRate: 0.045,
    iterations: 220,
    l2: 0.003,
    runtime: prepared.runtime
  });
}

export function predictPaymentRisk({
  artifact,
  data,
  modelVersion
}: {
  artifact: VectorModelArtifact;
  data: FirstPartyTrainingData;
  modelVersion?: string;
}): PaymentRiskPrediction[] {
  return buildPaymentRiskPredictionExamples(data)
    .map((example) => {
      const followUpRisk = clamp(predictLogisticProbability(artifact, example.features), 0, 1);
      const explanation = explainPaymentRiskPrediction({ artifact, features: example.features, riskScore: followUpRisk });

      return {
        modelType: "payment_risk" as const,
        entityType: "payment" as const,
        entityId: example.entityId,
        predictionJson: {
          orderId: typeof example.metadata.orderId === "string" ? example.metadata.orderId : null,
          customerId: typeof example.metadata.customerId === "string" ? example.metadata.customerId : null,
          amount: typeof example.metadata.amount === "number" ? example.metadata.amount : 0,
          status: String(example.metadata.status ?? "UNKNOWN"),
          provider: String(example.metadata.provider ?? "UNKNOWN"),
          followUpRisk: round(followUpRisk, 4)
        },
        confidence: clamp(confidenceFromClassification(artifact, followUpRisk, example.features), 0, 1),
        explanationJson: explanation,
        modelVersion
      };
    })
    .sort((first, second) => second.predictionJson.followUpRisk - first.predictionJson.followUpRisk || second.confidence - first.confidence)
    .slice(0, 50);
}
