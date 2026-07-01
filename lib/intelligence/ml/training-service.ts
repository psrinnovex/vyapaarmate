import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { demandTrainingExamples, trainDemandForecastModel } from "@/lib/intelligence/ml/demand-forecast-model";
import {
  evaluateModelReadiness,
  type FirstPartyTrainingData,
  type FirstPartyOrderRecord,
  type FirstPartyPaymentRecord
} from "@/lib/intelligence/ml/features";
import { paymentRiskTrainingExamples, trainPaymentRiskModel } from "@/lib/intelligence/ml/payment-risk-model";
import { retentionTrainingExamples, trainRetentionModel } from "@/lib/intelligence/ml/retention-model";
import {
  buildEngineSummary,
  intelligenceModelStatuses,
  intelligenceModelTypes,
  isIntelligenceModelType,
  modelTypesForRequest,
  type IntelligenceModelStatus,
  type IntelligenceModelType,
  type ModelTrainingResult,
  type PersistedModelStatus,
  type VectorModelArtifact
} from "@/lib/intelligence/ml/model-registry";

const recentModelMaxAgeMs = 7 * 24 * 60 * 60 * 1000;
const failedRetryBackoffMs = 6 * 60 * 60 * 1000;

function decimalToNumber(value: Prisma.Decimal | number | string) {
  return Number(value);
}

function jsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

function isDisabled() {
  return process.env.INTELLIGENCE_ML_DISABLED === "1" || process.env.INTELLIGENCE_ML_DISABLED === "true";
}

function safeStatus(status: string | null | undefined): IntelligenceModelStatus | null {
  return intelligenceModelStatuses.includes(status as IntelligenceModelStatus) ? (status as IntelligenceModelStatus) : null;
}

function versionFor(modelType: IntelligenceModelType) {
  return `${modelType}_v${Date.now()}`;
}

function pickTrainingFunction(modelType: IntelligenceModelType, data: FirstPartyTrainingData): ModelTrainingResult {
  if (modelType === "demand") return trainDemandForecastModel(demandTrainingExamples(data));
  if (modelType === "retention") return trainRetentionModel(retentionTrainingExamples(data));
  return trainPaymentRiskModel(paymentRiskTrainingExamples(data));
}

function resolvedModelStatus({
  baseStatus,
  latestArtifact,
  latestRun
}: {
  baseStatus: IntelligenceModelStatus;
  latestArtifact: Awaited<ReturnType<typeof prisma.intelligenceModelArtifact.findFirst>> | null;
  latestRun: Awaited<ReturnType<typeof prisma.intelligenceTrainingRun.findFirst>> | null;
}): IntelligenceModelStatus {
  if (isDisabled()) return "disabled";
  const runStatus = safeStatus(latestRun?.status);
  if (runStatus === "training") return "training";
  if (latestArtifact?.status === "trained") return "trained";
  if (runStatus === "failed" && baseStatus === "ready_for_training") return "failed";
  return baseStatus;
}

export async function fetchFirstPartyTrainingData(businessId: string): Promise<FirstPartyTrainingData> {
  const [business, menuItems, customers, orders, payments] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, businessType: true }
    }),
    prisma.menuItem.findMany({
      where: { businessId },
      orderBy: [{ isAvailable: "desc" }, { updatedAt: "desc" }],
      take: 1000,
      select: {
        id: true,
        name: true,
        categoryId: true,
        isAvailable: true,
        price: true,
        category: { select: { id: true, name: true } }
      }
    }),
    prisma.customer.findMany({
      where: { businessId },
      orderBy: { createdAt: "asc" },
      take: 20000,
      select: {
        id: true,
        name: true,
        phone: true,
        totalOrders: true,
        totalSpent: true,
        lastOrderAt: true,
        createdAt: true
      }
    }),
    prisma.order.findMany({
      where: { businessId },
      orderBy: { createdAt: "asc" },
      take: 50000,
      select: {
        id: true,
        customerId: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        orderType: true,
        createdAt: true,
        items: {
          select: {
            id: true,
            menuItemId: true,
            itemName: true,
            quantity: true,
            total: true,
            menuItem: {
              select: {
                categoryId: true,
                category: { select: { id: true, name: true } }
              }
            }
          }
        }
      }
    }),
    prisma.payment.findMany({
      where: { businessId },
      orderBy: { createdAt: "asc" },
      take: 50000,
      select: {
        id: true,
        businessId: true,
        orderId: true,
        amount: true,
        status: true,
        provider: true,
        createdAt: true,
        paidAt: true,
        order: {
          select: {
            customerId: true,
            status: true,
            paymentStatus: true
          }
        }
      }
    })
  ]);

  if (!business) {
    throw new Error(`Business ${businessId} was not found for intelligence training.`);
  }

  return {
    business,
    menuItems: menuItems.map((item) => ({
      id: item.id,
      name: item.name,
      categoryId: item.categoryId,
      categoryName: item.category.name,
      isAvailable: item.isAvailable,
      price: decimalToNumber(item.price)
    })),
    customers: customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      totalOrders: customer.totalOrders,
      totalSpent: decimalToNumber(customer.totalSpent),
      lastOrderAt: customer.lastOrderAt,
      createdAt: customer.createdAt
    })),
    orders: orders.map<FirstPartyOrderRecord>((order) => ({
      id: order.id,
      customerId: order.customerId,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: decimalToNumber(order.totalAmount),
      orderType: order.orderType,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        id: item.id,
        menuItemId: item.menuItemId,
        itemName: item.itemName,
        quantity: item.quantity,
        total: decimalToNumber(item.total),
        categoryId: item.menuItem?.categoryId ?? null,
        categoryName: item.menuItem?.category.name ?? null
      }))
    })),
    payments: payments.map<FirstPartyPaymentRecord>((payment) => ({
      id: payment.id,
      businessId: payment.businessId,
      orderId: payment.orderId,
      customerId: payment.order.customerId,
      amount: decimalToNumber(payment.amount),
      status: payment.status,
      provider: payment.provider,
      orderStatus: payment.order.status,
      orderPaymentStatus: payment.order.paymentStatus,
      createdAt: payment.createdAt,
      paidAt: payment.paidAt
    })),
    now: new Date()
  };
}

export async function getIntelligenceModelStatuses(businessId: string): Promise<PersistedModelStatus[]> {
  const data = await fetchFirstPartyTrainingData(businessId);
  const [artifacts, runs] = await Promise.all([
    prisma.intelligenceModelArtifact.findMany({
      where: { businessId },
      orderBy: [{ trainedAt: "desc" }, { createdAt: "desc" }]
    }),
    prisma.intelligenceTrainingRun.findMany({
      where: { businessId },
      orderBy: { startedAt: "desc" }
    })
  ]);

  return intelligenceModelTypes.map((modelType) => {
    const readiness = evaluateModelReadiness(data, modelType);
    const latestArtifact = artifacts.find((artifact) => artifact.modelType === modelType && artifact.status === "trained") ?? null;
    const latestRun = runs.find((run) => run.modelType === modelType) ?? null;
    const status = resolvedModelStatus({ baseStatus: readiness.status, latestArtifact, latestRun });

    return {
      ...readiness,
      status,
      latestVersion: latestArtifact?.version ?? null,
      latestAlgorithm: latestArtifact?.algorithm ?? null,
      lastTrainedAt: latestArtifact?.trainedAt?.toISOString() ?? null,
      latestTrainingRows: latestRun?.trainRows ?? null,
      latestValidationRows: latestRun?.validationRows ?? null,
      latestMetrics: (latestArtifact?.metricsJson as PersistedModelStatus["latestMetrics"]) ?? null,
      latestRunStatus: safeStatus(latestRun?.status),
      latestRunStartedAt: latestRun?.startedAt.toISOString() ?? null,
      latestRunCompletedAt: latestRun?.completedAt?.toISOString() ?? null,
      latestRunError: latestRun?.errorMessage ?? null
    };
  });
}

export async function getModelStatusPayload(businessId: string) {
  const models = await getIntelligenceModelStatuses(businessId);

  return {
    businessId,
    generatedAt: new Date().toISOString(),
    engine: buildEngineSummary(models),
    models
  };
}

async function latestTrainedArtifact(businessId: string, modelType: IntelligenceModelType) {
  return prisma.intelligenceModelArtifact.findFirst({
    where: { businessId, modelType, status: "trained" },
    orderBy: [{ trainedAt: "desc" }, { createdAt: "desc" }]
  });
}

async function latestFailedRun(businessId: string, modelType: IntelligenceModelType) {
  return prisma.intelligenceTrainingRun.findFirst({
    where: { businessId, modelType, status: "failed" },
    orderBy: { startedAt: "desc" }
  });
}

function isRecentArtifact(artifact: Awaited<ReturnType<typeof latestTrainedArtifact>> | null) {
  return Boolean(artifact?.trainedAt && Date.now() - artifact.trainedAt.getTime() <= recentModelMaxAgeMs);
}

function isRecentFailure(run: Awaited<ReturnType<typeof latestFailedRun>> | null) {
  return Boolean(run?.startedAt && Date.now() - run.startedAt.getTime() <= failedRetryBackoffMs);
}

export async function hasRecentValidModel(businessId: string, modelType: IntelligenceModelType) {
  return isRecentArtifact(await latestTrainedArtifact(businessId, modelType));
}

export async function hasRecentTrainingFailure(businessId: string, modelType: IntelligenceModelType) {
  return isRecentFailure(await latestFailedRun(businessId, modelType));
}

export async function trainIntelligenceModel({
  businessId,
  modelType,
  data
}: {
  businessId: string;
  modelType: IntelligenceModelType;
  data?: FirstPartyTrainingData;
}) {
  const trainingData = data ?? (await fetchFirstPartyTrainingData(businessId));
  const readiness = evaluateModelReadiness(trainingData, modelType);

  if (isDisabled()) {
    return { modelType, status: "disabled" as const, readiness, artifact: null, run: null };
  }

  if (readiness.status !== "ready_for_training") {
    return { modelType, status: "needs_data" as const, readiness, artifact: null, run: null };
  }

  const run = await prisma.intelligenceTrainingRun.create({
    data: {
      businessId,
      modelType,
      status: "training",
      rowsUsed: 0,
      trainRows: 0,
      validationRows: 0,
      startedAt: new Date()
    }
  });

  try {
    const trainingResult = pickTrainingFunction(modelType, trainingData);
    const artifact = trainingResult.artifact;
    const version = versionFor(modelType);
    const completedAt = new Date();

    const [storedArtifact, storedRun] = await prisma.$transaction([
      prisma.intelligenceModelArtifact.create({
        data: {
          businessId,
          modelType,
          version,
          status: "trained",
          algorithm: artifact.algorithm,
          featuresJson: jsonObject({
            modelType,
            featureNames: artifact.featureNames,
            means: artifact.means,
            stds: artifact.stds
          }),
          weightsJson: jsonObject({
            weights: artifact.weights,
            intercept: artifact.intercept,
            targetMean: artifact.targetMean ?? null,
            targetStd: artifact.targetStd ?? null
          }),
          artifactJson: jsonObject(artifact as unknown as Record<string, unknown>),
          metricsJson: jsonObject(trainingResult.metrics as unknown as Record<string, unknown>),
          trainedAt: completedAt,
          trainingDataStart: readiness.trainingDataStart,
          trainingDataEnd: readiness.trainingDataEnd
        }
      }),
      prisma.intelligenceTrainingRun.update({
        where: { id: run.id },
        data: {
          status: "trained",
          rowsUsed: trainingResult.rowsUsed,
          trainRows: trainingResult.trainRows,
          validationRows: trainingResult.validationRows,
          metricsJson: jsonObject(trainingResult.metrics as unknown as Record<string, unknown>),
          completedAt
        }
      })
    ]);

    return { modelType, status: "trained" as const, readiness, artifact: storedArtifact, run: storedRun, version };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown model training error";
    const failedRun = await prisma.intelligenceTrainingRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        errorMessage: message,
        completedAt: new Date()
      }
    });

    return { modelType, status: "failed" as const, readiness, artifact: null, run: failedRun, error: message };
  }
}

export async function trainIntelligenceModels({
  businessId,
  modelType
}: {
  businessId: string;
  modelType?: IntelligenceModelType | "all";
}) {
  const modelTypes = modelTypesForRequest(modelType ?? "all");
  if (!modelTypes) {
    throw new Error("Invalid intelligence model type.");
  }

  const data = await fetchFirstPartyTrainingData(businessId);
  const results = [];
  for (const type of modelTypes) {
    results.push(await trainIntelligenceModel({ businessId, modelType: type, data }));
  }

  return {
    businessId,
    generatedAt: new Date().toISOString(),
    results
  };
}

export async function latestTrainedArtifactsByType(businessId: string, modelTypes: IntelligenceModelType[] = [...intelligenceModelTypes]) {
  const rows = await prisma.intelligenceModelArtifact.findMany({
    where: { businessId, modelType: { in: modelTypes }, status: "trained" },
    orderBy: [{ trainedAt: "desc" }, { createdAt: "desc" }]
  });
  const byType = new Map<IntelligenceModelType, { version: string; artifact: VectorModelArtifact }>();

  rows.forEach((row) => {
    if (!isIntelligenceModelType(row.modelType) || byType.has(row.modelType)) return;
    byType.set(row.modelType, {
      version: row.version,
      artifact: row.artifactJson as unknown as VectorModelArtifact
    });
  });

  return byType;
}
