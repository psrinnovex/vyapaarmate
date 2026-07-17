import { Prisma } from "@prisma/client";
import { getBusinessIntelligencePayload } from "@/lib/business-intelligence-data";
import { prisma } from "@/lib/prisma";
import { predictDemandForecasts, type DemandForecastPrediction } from "@/lib/intelligence/ml/demand-forecast-model";
import { evaluateModelReadiness, type FirstPartyTrainingData } from "@/lib/intelligence/ml/features";
import { predictPaymentRisk, type PaymentRiskPrediction } from "@/lib/intelligence/ml/payment-risk-model";
import { predictRetention, type RetentionPrediction } from "@/lib/intelligence/ml/retention-model";
import {
  buildEngineSummary,
  intelligenceModelTypes,
  type IntelligenceModelType,
  type PersistedModelStatus
} from "@/lib/intelligence/ml/model-registry";
import {
  fetchFirstPartyTrainingData,
  getIntelligenceModelStatuses,
  hasRecentTrainingFailure,
  hasRecentValidModel,
  latestTrainedArtifactsByType,
  monitorIntelligenceModels,
  trainIntelligenceModel
} from "@/lib/intelligence/ml/training-service";

export type MLPrediction = DemandForecastPrediction | RetentionPrediction | PaymentRiskPrediction;

function jsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

function groupPredictions(predictions: MLPrediction[]) {
  return {
    demand: predictions.filter((prediction): prediction is DemandForecastPrediction => prediction.modelType === "demand"),
    retention: predictions.filter((prediction): prediction is RetentionPrediction => prediction.modelType === "retention"),
    paymentRisk: predictions.filter((prediction): prediction is PaymentRiskPrediction => prediction.modelType === "payment_risk")
  };
}

export function buildFallbackPredictionResponse({
  businessId,
  statuses,
  rulesPayload
}: {
  businessId: string;
  statuses: PersistedModelStatus[];
  rulesPayload: Awaited<ReturnType<typeof getBusinessIntelligencePayload>>;
}) {
  return {
    businessId,
    generatedAt: new Date().toISOString(),
    engine: buildEngineSummary(statuses),
    fallback: true,
    fallbackReason: "No trained first-party ML model artifact is available for this business yet.",
    dataSource: "first_party_database" as const,
    externalDatasets: "isolated_evaluation_only" as const,
    syntheticProductionData: "none" as const,
    predictions: {
      demand: [],
      retention: [],
      paymentRisk: []
    },
    rulesEngine: rulesPayload
  };
}

export async function generatePredictionsFromArtifacts({
  businessId,
  data,
  modelTypes = [...intelligenceModelTypes]
}: {
  businessId: string;
  data: FirstPartyTrainingData;
  modelTypes?: IntelligenceModelType[];
}) {
  const artifacts = await latestTrainedArtifactsByType(businessId, modelTypes);
  const predictions: MLPrediction[] = [];

  const demand = artifacts.get("demand");
  if (demand) {
    predictions.push(...predictDemandForecasts({ artifact: demand.artifact, data, modelVersion: demand.version }));
  }

  const retention = artifacts.get("retention");
  if (retention) {
    predictions.push(...predictRetention({ artifact: retention.artifact, data, modelVersion: retention.version }));
  }

  const paymentRisk = artifacts.get("payment_risk");
  if (paymentRisk) {
    predictions.push(...predictPaymentRisk({ artifact: paymentRisk.artifact, data, modelVersion: paymentRisk.version }));
  }

  return predictions;
}

export async function generateAndStorePredictions({
  businessId,
  data,
  modelTypes = [...intelligenceModelTypes]
}: {
  businessId: string;
  data?: FirstPartyTrainingData;
  modelTypes?: IntelligenceModelType[];
}) {
  const trainingData = data ?? (await fetchFirstPartyTrainingData(businessId));
  const predictions = await generatePredictionsFromArtifacts({ businessId, data: trainingData, modelTypes });
  const pruneBefore = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  await prisma.intelligencePrediction.deleteMany({
    where: {
      businessId,
      modelType: { in: modelTypes },
      createdAt: { lt: pruneBefore }
    }
  });

  if (predictions.length) {
    await prisma.intelligencePrediction.createMany({
      data: predictions.map((prediction) => ({
        businessId,
        modelType: prediction.modelType,
        entityType: prediction.entityType,
        entityId: prediction.entityId,
        predictionJson: jsonObject(prediction.predictionJson as unknown as Record<string, unknown>),
        confidence: prediction.confidence,
        explanationJson: jsonObject(prediction.explanationJson as unknown as Record<string, unknown>),
        modelVersion: prediction.modelVersion
      }))
    });
  }

  return {
    fallback: predictions.length === 0,
    generated: predictions.length,
    predictions: groupPredictions(predictions)
  };
}

export async function getPredictionsOrFallback(businessId: string) {
  const statuses = await getIntelligenceModelStatuses(businessId);
  const trainedTypes = statuses.filter((status) => status.status === "trained").map((status) => status.modelType);

  if (!trainedTypes.length) {
    const rulesPayload = await getBusinessIntelligencePayload(businessId);
    return buildFallbackPredictionResponse({ businessId, statuses, rulesPayload });
  }

  const predictionResult = await generateAndStorePredictions({ businessId, modelTypes: trainedTypes });
  const refreshedStatuses = await getIntelligenceModelStatuses(businessId);

  return {
    businessId,
    generatedAt: new Date().toISOString(),
    engine: buildEngineSummary(refreshedStatuses),
    fallback: predictionResult.fallback,
    fallbackReason: predictionResult.fallback ? "Trained artifacts exist, but no current prediction examples were available." : null,
    dataSource: "first_party_database" as const,
    externalDatasets: "isolated_evaluation_only" as const,
    syntheticProductionData: "none" as const,
    predictions: predictionResult.predictions
  };
}

export async function refreshBusinessMlIntelligence(businessId: string) {
  const data = await fetchFirstPartyTrainingData(businessId);
  const trainingResults = [];

  for (const modelType of intelligenceModelTypes) {
    const readiness = evaluateModelReadiness(data, modelType);
    if (readiness.status !== "ready_for_training") {
      trainingResults.push({ modelType, status: readiness.status, readiness, trained: false });
      continue;
    }

    if (await hasRecentValidModel(businessId, modelType)) {
      trainingResults.push({ modelType, status: "trained", readiness, trained: false, reason: "recent_valid_model_exists" });
      continue;
    }

    if (await hasRecentTrainingFailure(businessId, modelType)) {
      trainingResults.push({ modelType, status: "failed", readiness, trained: false, reason: "recent_training_failure" });
      continue;
    }

    trainingResults.push(await trainIntelligenceModel({ businessId, modelType, data, trigger: "cron" }));
  }

  const monitoring = await monitorIntelligenceModels({ businessId, data });
  const predictionResult = await generateAndStorePredictions({ businessId, data });
  const statuses = await getIntelligenceModelStatuses(businessId);

  return {
    businessId,
    engine: buildEngineSummary(statuses),
    trainingResults,
    monitoring,
    predictions: predictionResult,
    fallbackUsed: predictionResult.fallback
  };
}
