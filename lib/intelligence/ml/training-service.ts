import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { productionTrainingOrigins } from "@/lib/intelligence/benchmark-datasets";
import { demandTrainingExamples, trainDemandForecastModel } from "@/lib/intelligence/ml/demand-forecast-model";
import {
  buildDemandPredictionExamples,
  buildPaymentRiskPredictionExamples,
  buildRetentionPredictionExamples,
  evaluateModelReadiness,
  type FirstPartyTrainingData,
  type FirstPartyOrderRecord,
  type FirstPartyPaymentRecord
} from "@/lib/intelligence/ml/features";
import { assessModelDrift, type IntelligenceDriftAssessment } from "@/lib/intelligence/ml/drift";
import { paymentRiskTrainingExamples, trainPaymentRiskModel } from "@/lib/intelligence/ml/payment-risk-model";
import { retentionTrainingExamples, trainRetentionModel } from "@/lib/intelligence/ml/retention-model";
import {
  buildEngineSummary,
  intelligenceFeatureSchemaVersions,
  intelligenceModelStatuses,
  intelligenceModelTypes,
  isIntelligenceModelType,
  isCompatibleModelArtifact,
  modelTypesForRequest,
  type IntelligenceModelStatus,
  type IntelligenceModelType,
  type IntelligenceArtifactLifecycleStatus,
  type ModelTrainingResult,
  type PersistedModelStatus,
  type VectorModelArtifact
} from "@/lib/intelligence/ml/model-registry";

const recentModelMaxAgeMs = 7 * 24 * 60 * 60 * 1000;
const failedRetryBackoffMs = 6 * 60 * 60 * 1000;
const trainingLeaseMs = 5 * 60 * 1000;

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
  return `${modelType}_schema${intelligenceFeatureSchemaVersions[modelType]}_v${Date.now()}`;
}

function pickTrainingFunction(modelType: IntelligenceModelType, data: FirstPartyTrainingData): ModelTrainingResult {
  if (modelType === "demand") return trainDemandForecastModel(demandTrainingExamples(data));
  if (modelType === "retention") return trainRetentionModel(retentionTrainingExamples(data));
  return trainPaymentRiskModel(paymentRiskTrainingExamples(data));
}

function resolvedModelStatus({
  baseStatus,
  latestActiveArtifact,
  latestShadowArtifact,
  latestRun
}: {
  baseStatus: IntelligenceModelStatus;
  latestActiveArtifact: Awaited<ReturnType<typeof prisma.intelligenceModelArtifact.findFirst>> | null;
  latestShadowArtifact: Awaited<ReturnType<typeof prisma.intelligenceModelArtifact.findFirst>> | null;
  latestRun: Awaited<ReturnType<typeof prisma.intelligenceTrainingRun.findFirst>> | null;
}): IntelligenceModelStatus {
  if (isDisabled()) return "disabled";
  const runStatus = safeStatus(latestRun?.status);
  if (latestActiveArtifact?.status === "trained") return "trained";
  if (runStatus === "training") return "training";
  if (latestShadowArtifact?.status === "trained") return "shadow";
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
      where: {
        businessId,
        trainingEligible: true,
        dataOrigin: { in: [...productionTrainingOrigins] },
        category: {
          trainingEligible: true,
          dataOrigin: { in: [...productionTrainingOrigins] }
        }
      },
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
      where: {
        businessId,
        trainingEligible: true,
        dataOrigin: { in: [...productionTrainingOrigins] }
      },
      orderBy: { createdAt: "desc" },
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
      where: {
        businessId,
        trainingEligible: true,
        dataOrigin: { in: [...productionTrainingOrigins] },
        customer: {
          trainingEligible: true,
          dataOrigin: { in: [...productionTrainingOrigins] }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 50000,
      select: {
        id: true,
        customerId: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        orderType: true,
        createdAt: true,
        scheduledFor: true,
        completedAt: true,
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
      where: {
        businessId,
        trainingEligible: true,
        dataOrigin: { in: [...productionTrainingOrigins] },
        order: {
          trainingEligible: true,
          dataOrigin: { in: [...productionTrainingOrigins] },
          customer: {
            trainingEligible: true,
            dataOrigin: { in: [...productionTrainingOrigins] }
          }
        }
      },
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
        updatedAt: true,
        order: {
          select: {
            customerId: true
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
      scheduledFor: order.scheduledFor,
      completedAt: order.completedAt,
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
      createdAt: payment.createdAt,
      paidAt: payment.paidAt,
      resolvedAt: payment.updatedAt
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
    const latestActiveArtifact = artifacts.find(
      (artifact) =>
        artifact.modelType === modelType &&
        artifact.status === "trained" &&
        artifact.lifecycleStatus === "active" &&
        isCompatibleModelArtifact(artifact.artifactJson, modelType)
    ) ?? null;
    const latestShadowArtifact = artifacts.find(
      (artifact) =>
        artifact.modelType === modelType &&
        artifact.status === "trained" &&
        artifact.lifecycleStatus === "shadow" &&
        isCompatibleModelArtifact(artifact.artifactJson, modelType)
    ) ?? null;
    const effectiveArtifact = latestActiveArtifact ?? latestShadowArtifact;
    const latestRun = runs.find((run) => run.modelType === modelType) ?? null;
    const status = resolvedModelStatus({ baseStatus: readiness.status, latestActiveArtifact, latestShadowArtifact, latestRun });

    return {
      ...readiness,
      status,
      latestVersion: effectiveArtifact?.version ?? null,
      latestAlgorithm: effectiveArtifact?.algorithm ?? null,
      lastTrainedAt: effectiveArtifact?.trainedAt?.toISOString() ?? null,
      latestTrainingRows: latestRun?.trainRows ?? null,
      latestValidationRows: latestRun?.validationRows ?? null,
      latestMetrics: (effectiveArtifact?.metricsJson as PersistedModelStatus["latestMetrics"]) ?? null,
      latestRunStatus: safeStatus(latestRun?.status),
      latestRunStartedAt: latestRun?.startedAt.toISOString() ?? null,
      latestRunCompletedAt: latestRun?.completedAt?.toISOString() ?? null,
      latestRunError: latestRun?.errorMessage ?? null,
      lifecycleStatus: (effectiveArtifact?.lifecycleStatus as IntelligenceArtifactLifecycleStatus | undefined) ?? null,
      promotionEligible: effectiveArtifact?.promotionEligible ?? false,
      baselineMetrics: (effectiveArtifact?.baselineMetricsJson as PersistedModelStatus["baselineMetrics"]) ?? null,
      evaluation: (effectiveArtifact?.evaluationJson as PersistedModelStatus["evaluation"]) ?? null,
      driftStatus: effectiveArtifact?.driftStatus ?? null,
      driftScore: effectiveArtifact?.driftScore ?? null,
      lastDriftCheckedAt: effectiveArtifact?.lastDriftCheckedAt?.toISOString() ?? null
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
  const artifacts = await prisma.intelligenceModelArtifact.findMany({
    where: { businessId, modelType, status: "trained", lifecycleStatus: "active" },
    orderBy: [{ trainedAt: "desc" }, { createdAt: "desc" }],
    take: 20
  });
  return artifacts.find((artifact) => isCompatibleModelArtifact(artifact.artifactJson, modelType)) ?? null;
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

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function expireStaleTrainingLease(businessId: string, modelType: IntelligenceModelType) {
  const now = new Date();
  const legacyLeaseCutoff = new Date(now.getTime() - trainingLeaseMs);
  await prisma.intelligenceTrainingRun.updateMany({
    where: {
      businessId,
      modelType,
      status: "training",
      OR: [
        { leaseExpiresAt: { lt: now } },
        { leaseExpiresAt: null, startedAt: { lt: legacyLeaseCutoff } }
      ]
    },
    data: {
      status: "failed",
      completedAt: now,
      errorMessage: "Training lease expired before completion."
    }
  });
}

async function promoteCandidateArtifact({
  businessId,
  modelType,
  artifactId
}: {
  businessId: string;
  modelType: IntelligenceModelType;
  artifactId: string;
}) {
  const promotedAt = new Date();
  return prisma.$transaction(async (tx) => {
    await tx.intelligenceModelArtifact.updateMany({
      where: {
        businessId,
        modelType,
        lifecycleStatus: "active",
        id: { not: artifactId }
      },
      data: {
        lifecycleStatus: "retired",
        retiredAt: promotedAt
      }
    });
    return tx.intelligenceModelArtifact.update({
      where: { id: artifactId },
      data: {
        lifecycleStatus: "active",
        promotedAt,
        retiredAt: null,
        rollbackReason: null
      }
    });
  });
}

export async function trainIntelligenceModel({
  businessId,
  modelType,
  data,
  trigger = "manual"
}: {
  businessId: string;
  modelType: IntelligenceModelType;
  data?: FirstPartyTrainingData;
  trigger?: "manual" | "cron";
}) {
  const trainingData = data ?? (await fetchFirstPartyTrainingData(businessId));
  const readiness = evaluateModelReadiness(trainingData, modelType);

  if (isDisabled()) {
    return { modelType, status: "disabled" as const, readiness, artifact: null, run: null };
  }

  if (readiness.status !== "ready_for_training") {
    return { modelType, status: "needs_data" as const, readiness, artifact: null, run: null };
  }

  await expireStaleTrainingLease(businessId, modelType);
  const startedAt = new Date();
  let run: Awaited<ReturnType<typeof prisma.intelligenceTrainingRun.create>>;
  try {
    run = await prisma.intelligenceTrainingRun.create({
      data: {
        businessId,
        modelType,
        status: "training",
        trigger,
        rowsUsed: 0,
        trainRows: 0,
        validationRows: 0,
        startedAt,
        heartbeatAt: startedAt,
        leaseExpiresAt: new Date(startedAt.getTime() + trainingLeaseMs)
      }
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        modelType,
        status: "training" as const,
        readiness,
        artifact: null,
        run: null,
        reason: "concurrent_training_in_progress"
      };
    }
    throw error;
  }

  try {
    const trainingResult = pickTrainingFunction(modelType, trainingData);
    const artifact = trainingResult.artifact;
    if (!isCompatibleModelArtifact(artifact, modelType)) {
      throw new Error("Training produced an invalid or incompatible model artifact.");
    }
    const version = versionFor(modelType);
    const completedAt = new Date();
    const promotionEligible = trainingResult.evaluation.promotion.passed;

    const [storedArtifact, storedRun] = await prisma.$transaction([
      prisma.intelligenceModelArtifact.create({
        data: {
          businessId,
          modelType,
          version,
          status: "trained",
          lifecycleStatus: "shadow",
          promotionEligible,
          algorithm: artifact.algorithm,
          featuresJson: jsonObject({
            modelType,
            featureSchemaVersion: artifact.featureSchemaVersion,
            featureNames: artifact.featureNames,
            means: artifact.means,
            stds: artifact.stds,
            referenceMeans: artifact.referenceMeans ?? null,
            referenceStds: artifact.referenceStds ?? null
          }),
          weightsJson: jsonObject({
            weights: artifact.weights,
            intercept: artifact.intercept,
            targetMean: artifact.targetMean ?? null,
            targetStd: artifact.targetStd ?? null,
            decisionThreshold: artifact.decisionThreshold ?? null,
            calibration: artifact.calibration ?? null
          }),
          artifactJson: jsonObject(artifact as unknown as Record<string, unknown>),
          metricsJson: jsonObject(trainingResult.metrics as unknown as Record<string, unknown>),
          baselineMetricsJson: jsonObject(trainingResult.evaluation.baselineMetrics as unknown as Record<string, unknown>),
          evaluationJson: jsonObject(trainingResult.evaluation as unknown as Record<string, unknown>),
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
          candidateVersion: version,
          promotionDecision: jsonObject(trainingResult.evaluation.promotion as unknown as Record<string, unknown>),
          completedAt,
          heartbeatAt: completedAt,
          leaseExpiresAt: null
        }
      })
    ]);

    const promotedArtifact = promotionEligible
      ? await promoteCandidateArtifact({ businessId, modelType, artifactId: storedArtifact.id })
      : null;

    return {
      modelType,
      status: promotedArtifact ? "trained" as const : "shadow" as const,
      readiness,
      artifact: promotedArtifact ?? storedArtifact,
      run: storedRun,
      version,
      evaluation: trainingResult.evaluation,
      promotionEligible,
      promoted: Boolean(promotedArtifact)
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown model training error";
    const failedRun = await prisma.intelligenceTrainingRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        errorMessage: message,
        completedAt: new Date(),
        leaseExpiresAt: null
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
    results.push(await trainIntelligenceModel({ businessId, modelType: type, data, trigger: "manual" }));
  }

  return {
    businessId,
    generatedAt: new Date().toISOString(),
    results
  };
}

export async function latestTrainedArtifactsByType(businessId: string, modelTypes: IntelligenceModelType[] = [...intelligenceModelTypes]) {
  const rows = await prisma.intelligenceModelArtifact.findMany({
    where: { businessId, modelType: { in: modelTypes }, status: "trained", lifecycleStatus: "active" },
    orderBy: [{ trainedAt: "desc" }, { createdAt: "desc" }]
  });
  const byType = new Map<IntelligenceModelType, { version: string; artifact: VectorModelArtifact }>();

  rows.forEach((row) => {
    if (!isIntelligenceModelType(row.modelType) || byType.has(row.modelType)) return;
    if (!isCompatibleModelArtifact(row.artifactJson, row.modelType)) return;
    byType.set(row.modelType, {
      version: row.version,
      artifact: row.artifactJson
    });
  });

  return byType;
}

function driftExamplesForModel(data: FirstPartyTrainingData, modelType: IntelligenceModelType) {
  if (modelType === "demand") return buildDemandPredictionExamples(data);
  if (modelType === "retention") return buildRetentionPredictionExamples(data);
  return buildPaymentRiskPredictionExamples(data);
}

function previousCriticalCount(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const count = value.consecutiveCritical;
  return typeof count === "number" && Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

export async function rollbackIntelligenceModel({
  businessId,
  modelType,
  reason
}: {
  businessId: string;
  modelType: IntelligenceModelType;
  reason: string;
}) {
  const rows = await prisma.intelligenceModelArtifact.findMany({
    where: {
      businessId,
      modelType,
      status: "trained",
      lifecycleStatus: { in: ["active", "retired"] }
    },
    orderBy: [{ promotedAt: "desc" }, { trainedAt: "desc" }, { createdAt: "desc" }]
  });
  const active = rows.find(
    (row) => row.lifecycleStatus === "active" && isCompatibleModelArtifact(row.artifactJson, modelType)
  );
  const replacement = rows.find(
    (row) => row.lifecycleStatus === "retired" && isCompatibleModelArtifact(row.artifactJson, modelType)
  );

  if (!active) {
    return { rolledBack: false as const, reason: "active_artifact_not_found", activeVersion: null, restoredVersion: null };
  }
  if (!replacement) {
    return {
      rolledBack: false as const,
      reason: "compatible_rollback_artifact_not_found",
      activeVersion: active.version,
      restoredVersion: null
    };
  }

  const restoredAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.intelligenceModelArtifact.update({
      where: { id: active.id },
      data: {
        lifecycleStatus: "rolled_back",
        retiredAt: restoredAt,
        rollbackReason: reason
      }
    });
    await tx.intelligenceModelArtifact.update({
      where: { id: replacement.id },
      data: {
        lifecycleStatus: "active",
        promotedAt: restoredAt,
        retiredAt: null,
        rollbackReason: null
      }
    });
  });

  return {
    rolledBack: true as const,
    reason,
    activeVersion: active.version,
    restoredVersion: replacement.version
  };
}

export async function monitorIntelligenceModels({
  businessId,
  data
}: {
  businessId: string;
  data?: FirstPartyTrainingData;
}) {
  const trainingData = data ?? (await fetchFirstPartyTrainingData(businessId));
  const activeRows = await prisma.intelligenceModelArtifact.findMany({
    where: {
      businessId,
      status: "trained",
      lifecycleStatus: "active",
      modelType: { in: [...intelligenceModelTypes] }
    },
    orderBy: [{ trainedAt: "desc" }, { createdAt: "desc" }]
  });
  const assessments: Array<{
    modelType: IntelligenceModelType;
    version: string;
    assessment: IntelligenceDriftAssessment;
    rollback: Awaited<ReturnType<typeof rollbackIntelligenceModel>> | null;
  }> = [];

  for (const row of activeRows) {
    if (!isIntelligenceModelType(row.modelType) || !isCompatibleModelArtifact(row.artifactJson, row.modelType)) continue;
    const examples = driftExamplesForModel(trainingData, row.modelType);
    const assessment = assessModelDrift({
      artifact: row.artifactJson,
      examples,
      previousConsecutiveCritical: previousCriticalCount(row.driftJson)
    });
    await prisma.intelligenceModelArtifact.update({
      where: { id: row.id },
      data: {
        driftStatus: assessment.status,
        driftScore: assessment.score,
        driftJson: jsonObject(assessment as unknown as Record<string, unknown>),
        lastDriftCheckedAt: new Date(assessment.checkedAt)
      }
    });
    const rollback = assessment.shouldRollback
      ? await rollbackIntelligenceModel({
          businessId,
          modelType: row.modelType,
          reason: `Automatic rollback after ${assessment.consecutiveCritical} consecutive critical drift checks (score ${assessment.score ?? "n/a"}).`
        })
      : null;
    assessments.push({ modelType: row.modelType, version: row.version, assessment, rollback });
  }

  return assessments;
}
