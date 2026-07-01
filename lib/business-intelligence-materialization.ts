import { Prisma } from "@prisma/client";
import { getBusinessIntelligenceArtifacts } from "@/lib/business-intelligence-data";
import { prisma } from "@/lib/prisma";
import type {
  BusinessIntelligenceArtifacts,
  BusinessIntelligencePayload,
  DemandForecastResult,
  NextBestAction,
  RepeatCustomerScoreResult,
  SmartCampaignRecommendation
} from "@/lib/business-intelligence";

const managedInsightTypes = [
  "next_best_action",
  "demand_forecast",
  "payment_priority",
  "retention_alert",
  "campaign_recommendation"
];

const dayMs = 24 * 60 * 60 * 1000;

export type BusinessIntelligenceMaterializationPlan = {
  aiInsights: Prisma.AIInsightCreateManyInput[];
  healthSnapshot: Prisma.BusinessHealthSnapshotCreateInput;
  customerScores: Prisma.CustomerIntelligenceScoreCreateManyInput[];
  demandForecasts: Prisma.DemandForecastCreateManyInput[];
  paymentPriorities: Prisma.PaymentPriorityCreateManyInput[];
};

export type BusinessIntelligenceRefreshResult = {
  businessId: string;
  source: BusinessIntelligencePayload["source"];
  generatedAt: string;
  persisted: {
    aiInsights: number;
    healthSnapshots: number;
    customerScores: number;
    demandForecasts: number;
    paymentPriorities: number;
  };
};

function isDemoId(value: string | null | undefined) {
  return Boolean(value?.startsWith("demo_"));
}

function confidenceScore(confidence: DemandForecastResult["confidence"]) {
  if (confidence === "High") return 0.9;
  if (confidence === "Medium") return 0.65;
  return 0.4;
}

function severityForPriority(priority: NextBestAction["priority"]) {
  if (priority === "High") return "warning";
  if (priority === "Medium") return "info";
  return "info";
}

function churnRiskScore(customer: RepeatCustomerScoreResult) {
  if (customer.segment === "Churn risk") return 100;
  if ((customer.daysSinceLastOrder ?? 0) >= 30) return 90;
  if ((customer.daysSinceLastOrder ?? 0) >= 21) return 70;
  if ((customer.daysSinceLastOrder ?? 0) >= 15) return 50;
  if (customer.segment === "Reminder opportunity") return 35;
  return 15;
}

function preferredCategory(customer: RepeatCustomerScoreResult) {
  return customer.preferredProducts[0] ?? null;
}

function sourceData(value: Prisma.InputJsonObject): Prisma.InputJsonObject {
  return value;
}

function nextBestActionInsights(businessId: string, payload: BusinessIntelligencePayload): Prisma.AIInsightCreateManyInput[] {
  return payload.nextBestActions.slice(0, 5).map((action) => ({
    businessId,
    type: "next_best_action",
    title: action.title,
    description: action.description,
    severity: severityForPriority(action.priority),
    confidence: action.priority === "High" ? 0.85 : action.priority === "Medium" ? 0.65 : 0.45,
    suggestedAction: action.description,
    sourceData: sourceData({
      priority: action.priority,
      generatedAt: payload.generatedAt
    })
  }));
}

function demandForecastInsights(businessId: string, payload: BusinessIntelligencePayload): Prisma.AIInsightCreateManyInput[] {
  return payload.tomorrowDemandForecast.slice(0, 3).map((forecast) => ({
    businessId,
    type: "demand_forecast",
    title: `Prepare ${forecast.productName}`,
    description: `Forecast demand is ${forecast.predictedQuantity} units for the ${forecast.timeSlot} slot.`,
    severity: forecast.confidence === "High" ? "warning" : "info",
    confidence: forecast.confidenceScore / 100,
    suggestedAction: `Prepare around ${forecast.predictedQuantity} units before the ${forecast.timeSlot} slot.`,
    sourceData: sourceData({
      productId: forecast.productId,
      productName: forecast.productName,
      forecastDate: forecast.forecastDate,
      timeSlot: forecast.timeSlot,
      predictedQuantity: forecast.predictedQuantity,
      confidence: forecast.confidence
    })
  }));
}

function paymentPriorityInsights(businessId: string, payload: BusinessIntelligencePayload): Prisma.AIInsightCreateManyInput[] {
  return payload.paymentPriorities.slice(0, 3).map((payment) => ({
    businessId,
    type: "payment_priority",
    title: `Follow up ${payment.customerName}`,
    description: `Rs. ${Math.round(payment.amountPending)} is pending for ${payment.daysOverdue} days.`,
    severity: payment.priority >= 70 ? "warning" : "info",
    confidence: payment.priority / 100,
    suggestedAction: payment.suggestedMessage,
    sourceData: sourceData({
      customerId: payment.customerId,
      orderId: payment.orderId,
      amountPending: payment.amountPending,
      daysOverdue: payment.daysOverdue,
      priority: payment.priority
    })
  }));
}

function retentionInsights(businessId: string, payload: BusinessIntelligencePayload): Prisma.AIInsightCreateManyInput[] {
  return payload.customerRetentionAlerts.customers.slice(0, 5).map((customer) => ({
    businessId,
    type: "retention_alert",
    title: `Retain ${customer.customerName}`,
    description: `${customer.customerName} has not ordered for ${customer.daysSinceLastOrder ?? 0} days.`,
    severity: churnRiskScore(customer) >= 70 ? "warning" : "info",
    confidence: customer.score / 100,
    suggestedAction: customer.recommendedAction,
    sourceData: sourceData({
      customerId: customer.customerId,
      segment: customer.segment,
      score: customer.score,
      daysSinceLastOrder: customer.daysSinceLastOrder,
      preferredProducts: customer.preferredProducts
    })
  }));
}

function campaignInsights(businessId: string, campaigns: SmartCampaignRecommendation[], generatedAt: string): Prisma.AIInsightCreateManyInput[] {
  return campaigns.slice(0, 3).map((campaign) => ({
    businessId,
    type: "campaign_recommendation",
    title: campaign.title,
    description: campaign.reason,
    severity: campaign.eligibleCustomerCount > 0 ? "info" : "low",
    confidence: confidenceScore(campaign.confidence),
    suggestedAction: campaign.message,
    sourceData: sourceData({
      id: campaign.id,
      generatedAt,
      audience: campaign.audience,
      timing: campaign.timing,
      eligibleCustomerCount: campaign.eligibleCustomerCount,
      blockedCustomerCount: campaign.blockedCustomerCount
    })
  }));
}

function buildInsightRows(businessId: string, payload: BusinessIntelligencePayload) {
  return [
    ...nextBestActionInsights(businessId, payload),
    ...demandForecastInsights(businessId, payload),
    ...paymentPriorityInsights(businessId, payload),
    ...retentionInsights(businessId, payload),
    ...campaignInsights(businessId, payload.campaignRecommendations, payload.generatedAt)
  ];
}

export function buildBusinessIntelligenceMaterializationPlan({
  businessId,
  artifacts
}: {
  businessId: string;
  artifacts: BusinessIntelligenceArtifacts;
}): BusinessIntelligenceMaterializationPlan {
  const { payload, customerScores } = artifacts;
  const health = payload.businessHealthScore;
  const generatedAt = new Date(payload.generatedAt);

  return {
    aiInsights: buildInsightRows(businessId, payload),
    healthSnapshot: {
      business: { connect: { id: businessId } },
      score: health.score,
      salesTrend: health.salesTrend,
      repeatRate: health.repeatRate,
      pendingPaymentRisk: health.pendingPaymentRisk,
      activeCustomerRatio: health.activeCustomerRatio,
      explanation: health.explanation,
      createdAt: generatedAt
    },
    customerScores: customerScores
      .filter((customer) => !isDemoId(customer.customerId))
      .map((customer) => ({
        businessId,
        customerId: customer.customerId,
        repeatScore: customer.score,
        churnRisk: churnRiskScore(customer),
        preferredCategory: preferredCategory(customer),
        recommendedAction: customer.recommendedAction,
        lastCalculatedAt: generatedAt
      })),
    demandForecasts: payload.tomorrowDemandForecast.map((forecast) => ({
      businessId,
      productId: isDemoId(forecast.productId) ? null : forecast.productId,
      productName: forecast.productName,
      forecastDate: new Date(forecast.forecastDate),
      timeSlot: forecast.timeSlot,
      predictedQuantity: forecast.predictedQuantity,
      confidence: forecast.confidenceScore / 100,
      reason: forecast.reason,
      createdAt: generatedAt
    })),
    paymentPriorities:
      payload.source === "demo"
        ? []
        : payload.paymentPriorities
            .filter((payment) => !isDemoId(payment.customerId) && !isDemoId(payment.orderId))
            .map((payment) => ({
              businessId,
              customerId: payment.customerId,
              orderId: payment.orderId,
              amountPending: payment.amountPending,
              daysOverdue: payment.daysOverdue,
              priorityScore: payment.priority,
              suggestedMessage: payment.suggestedMessage,
              createdAt: generatedAt
            }))
  };
}

export async function refreshBusinessIntelligenceForBusiness(businessId: string): Promise<BusinessIntelligenceRefreshResult> {
  const artifacts = await getBusinessIntelligenceArtifacts(businessId);
  const plan = buildBusinessIntelligenceMaterializationPlan({ businessId, artifacts });
  const generatedAt = new Date(artifacts.payload.generatedAt);
  const pruneSnapshotsBefore = new Date(generatedAt.getTime() - 90 * dayMs);

  await prisma.$transaction(async (tx) => {
    await tx.aIInsight.deleteMany({ where: { businessId, type: { in: managedInsightTypes } } });
    await tx.customerIntelligenceScore.deleteMany({ where: { businessId } });
    await tx.demandForecast.deleteMany({ where: { businessId } });
    await tx.paymentPriority.deleteMany({ where: { businessId } });
    await tx.businessHealthSnapshot.deleteMany({ where: { businessId, createdAt: { lt: pruneSnapshotsBefore } } });

    if (plan.aiInsights.length) await tx.aIInsight.createMany({ data: plan.aiInsights });
    await tx.businessHealthSnapshot.create({ data: plan.healthSnapshot });
    if (plan.customerScores.length) await tx.customerIntelligenceScore.createMany({ data: plan.customerScores });
    if (plan.demandForecasts.length) await tx.demandForecast.createMany({ data: plan.demandForecasts });
    if (plan.paymentPriorities.length) await tx.paymentPriority.createMany({ data: plan.paymentPriorities });
  });

  return {
    businessId,
    source: artifacts.payload.source,
    generatedAt: artifacts.payload.generatedAt,
    persisted: {
      aiInsights: plan.aiInsights.length,
      healthSnapshots: 1,
      customerScores: plan.customerScores.length,
      demandForecasts: plan.demandForecasts.length,
      paymentPriorities: plan.paymentPriorities.length
    }
  };
}

export async function refreshBusinessIntelligence({
  businessId,
  limit = 100
}: {
  businessId?: string | null;
  limit?: number;
} = {}) {
  const boundedLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  const businesses = businessId
    ? [{ id: businessId }]
    : await prisma.business.findMany({
        where: { isActive: true },
        orderBy: { updatedAt: "desc" },
        take: boundedLimit,
        select: { id: true }
      });

  const refreshed: BusinessIntelligenceRefreshResult[] = [];
  const failed: Array<{ businessId: string; error: string }> = [];

  for (const business of businesses) {
    try {
      refreshed.push(await refreshBusinessIntelligenceForBusiness(business.id));
    } catch (error) {
      failed.push({
        businessId: business.id,
        error: error instanceof Error ? error.message : "Unknown intelligence refresh error"
      });
    }
  }

  return {
    checked: businesses.length,
    refreshed,
    failed
  };
}
