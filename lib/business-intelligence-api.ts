import type {
  BusinessIntelligencePayload,
  IntelligenceConfidence,
  NextBestAction,
  PaymentPriorityResult,
  RepeatCustomerScoreResult,
  SmartCampaignRecommendation
} from "@/lib/business-intelligence";

export type IntelligencePriority = "High" | "Medium" | "Low";

function sumPendingAmount(payments: PaymentPriorityResult[]) {
  return payments.reduce((sum, payment) => sum + payment.amountPending, 0);
}

function riskLevelForCustomer(customer: RepeatCustomerScoreResult): IntelligencePriority {
  if (customer.segment === "Churn risk") return "High";
  if ((customer.daysSinceLastOrder ?? 0) >= 21) return "High";
  if ((customer.daysSinceLastOrder ?? 0) >= 15) return "Medium";
  return "Low";
}

function confidencePriority(confidence: IntelligenceConfidence): IntelligencePriority {
  if (confidence === "High") return "High";
  if (confidence === "Medium") return "Medium";
  return "Low";
}

function actionPriority(action: NextBestAction): IntelligencePriority {
  return action.priority;
}

function campaignPriority(campaign: SmartCampaignRecommendation): IntelligencePriority {
  if (campaign.eligibleCustomerCount >= 5 && campaign.confidence !== "Low") return "High";
  if (campaign.eligibleCustomerCount > 0) return "Medium";
  return "Low";
}

export function buildIntelligenceSummary(payload: BusinessIntelligencePayload) {
  const health = payload.businessHealthScore;
  const pendingAmount = sumPendingAmount(payload.paymentPriorities);

  return {
    source: payload.source,
    generatedAt: payload.generatedAt,
    dataWindow: payload.dataWindow,
    business: payload.business,
    healthScore: {
      score: health.score,
      grade: health.grade,
      explanation: health.explanation,
      strengths: health.strengths,
      risks: health.risks,
      factors: health.factors
    },
    operatingSignals: {
      salesTrend: health.salesTrend,
      repeatRate: health.repeatRate,
      pendingPaymentRisk: health.pendingPaymentRisk,
      orderCompletionRate: health.orderCompletionRate,
      activeCustomerRatio: health.activeCustomerRatio,
      demandForecastCount: payload.tomorrowDemandForecast.length,
      repeatCustomerOpportunityCount: payload.repeatCustomerOpportunities.count,
      customerRetentionAlertCount: payload.customerRetentionAlerts.count,
      pendingPaymentPriorityCount: payload.paymentPriorities.length,
      pendingAmount
    },
    topProductTrend: payload.topProductTrend,
    nextBestActions: payload.nextBestActions.slice(0, 3)
  };
}

export function buildIntelligenceRecommendations(payload: BusinessIntelligencePayload) {
  return {
    source: payload.source,
    generatedAt: payload.generatedAt,
    dataWindow: payload.dataWindow,
    business: payload.business,
    actionQueue: payload.nextBestActions.map((action) => ({
      type: "next_best_action",
      priority: actionPriority(action),
      title: action.title,
      description: action.description
    })),
    demandPreparation: payload.tomorrowDemandForecast.slice(0, 6).map((forecast) => ({
      type: "demand_forecast",
      priority: confidencePriority(forecast.confidence),
      productId: forecast.productId,
      productName: forecast.productName,
      forecastDate: forecast.forecastDate,
      timeSlot: forecast.timeSlot,
      predictedQuantity: forecast.predictedQuantity,
      confidence: forecast.confidence,
      reason: forecast.reason
    })),
    paymentFollowUps: payload.paymentPriorities.slice(0, 6).map((payment) => ({
      type: "payment_follow_up",
      priority: payment.priority >= 70 ? "High" : payment.priority >= 45 ? "Medium" : "Low",
      customerId: payment.customerId,
      customerName: payment.customerName,
      orderId: payment.orderId,
      amountPending: payment.amountPending,
      daysOverdue: payment.daysOverdue,
      suggestedMessage: payment.suggestedMessage
    })),
    campaignRecommendations: payload.campaignRecommendations.map((campaign) => ({
      type: "campaign",
      priority: campaignPriority(campaign),
      id: campaign.id,
      title: campaign.title,
      audience: campaign.audience,
      timing: campaign.timing,
      message: campaign.message,
      consentNote: campaign.consentNote,
      eligibleCustomerCount: campaign.eligibleCustomerCount,
      blockedCustomerCount: campaign.blockedCustomerCount,
      confidence: campaign.confidence,
      reason: campaign.reason
    }))
  };
}

export function buildCustomersAtRisk(payload: BusinessIntelligencePayload) {
  return {
    source: payload.source,
    generatedAt: payload.generatedAt,
    dataWindow: payload.dataWindow,
    business: payload.business,
    count: payload.customerRetentionAlerts.count,
    summary: payload.customerRetentionAlerts.summary,
    customers: payload.customerRetentionAlerts.customers.map((customer) => ({
      customerId: customer.customerId,
      customerName: customer.customerName,
      phone: customer.phone,
      riskLevel: riskLevelForCustomer(customer),
      segment: customer.segment,
      score: customer.score,
      daysSinceLastOrder: customer.daysSinceLastOrder,
      totalOrders: customer.totalOrders,
      totalSpent: customer.totalSpent,
      preferredProducts: customer.preferredProducts,
      whatsappOptIn: customer.whatsappOptIn,
      marketingOptIn: customer.marketingOptIn,
      recommendedAction: customer.recommendedAction,
      scoreBreakdown: customer.scoreBreakdown
    }))
  };
}

export function buildRevenueOpportunities(payload: BusinessIntelligencePayload) {
  const pendingCollectionAmount = sumPendingAmount(payload.paymentPriorities);
  const topForecastUnits = payload.tomorrowDemandForecast.reduce((sum, forecast) => sum + forecast.predictedQuantity, 0);
  const primaryCampaign = payload.campaignRecommendations[0];

  return {
    source: payload.source,
    generatedAt: payload.generatedAt,
    dataWindow: payload.dataWindow,
    business: payload.business,
    opportunitySignals: {
      pendingCollectionAmount,
      pendingPaymentCount: payload.paymentPriorities.length,
      repeatCustomerOpportunityCount: payload.repeatCustomerOpportunities.count,
      marketingEligibleCustomerCount: payload.repeatCustomerOpportunities.eligibleCount,
      forecastedUnitsTomorrow: topForecastUnits,
      topProductUnitsThisWeek: payload.topProductTrend.unitsSold,
      topProductRepeatBuyers: payload.topProductTrend.repeatBuyers
    },
    opportunities: [
      ...(pendingCollectionAmount > 0
        ? [
            {
              type: "pending_collections",
              priority: payload.paymentPriorities[0]?.priority >= 70 ? "High" : "Medium",
              title: "Collect pending payments",
              description: `Rs. ${Math.round(pendingCollectionAmount)} is pending across ${payload.paymentPriorities.length} prioritized payment follow-ups.`,
              amount: pendingCollectionAmount,
              suggestedFirstAction: payload.paymentPriorities[0]?.suggestedMessage ?? null
            }
          ]
        : []),
      ...(payload.repeatCustomerOpportunities.count > 0
        ? [
            {
              type: "repeat_orders",
              priority: "High",
              title: "Recover repeat orders",
              description: payload.repeatCustomerOpportunities.summary,
              customerCount: payload.repeatCustomerOpportunities.count,
              suggestedFirstAction: payload.repeatCustomerOpportunities.customers[0]?.recommendedAction ?? null
            }
          ]
        : []),
      ...(primaryCampaign
        ? [
            {
              type: "campaign",
              priority: campaignPriority(primaryCampaign),
              title: primaryCampaign.title,
              description: primaryCampaign.reason,
              customerCount: primaryCampaign.eligibleCustomerCount,
              suggestedFirstAction: primaryCampaign.message
            }
          ]
        : []),
      ...(payload.tomorrowDemandForecast[0]
        ? [
            {
              type: "demand_preparation",
              priority: confidencePriority(payload.tomorrowDemandForecast[0].confidence),
              title: `Prepare ${payload.tomorrowDemandForecast[0].productName}`,
              description: `Forecast demand is ${payload.tomorrowDemandForecast[0].predictedQuantity} units for the ${payload.tomorrowDemandForecast[0].timeSlot} slot tomorrow.`,
              productName: payload.tomorrowDemandForecast[0].productName,
              predictedQuantity: payload.tomorrowDemandForecast[0].predictedQuantity
            }
          ]
        : [])
    ]
  };
}
