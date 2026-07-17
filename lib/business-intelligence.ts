import {
  addBusinessDays as addDays,
  atBusinessHour,
  businessDayOfWeek,
  businessDaysBetween as daysBetween,
  businessHour,
  businessWeekdayName as weekdayName,
  startOfBusinessDay as startOfDay
} from "@/lib/intelligence/intelligence-time";

export type IntelligenceConfidence = "Low" | "Medium" | "High";
export type IntelligenceSource = "database" | "demo";
export type IntelligenceTimeSlot = "morning" | "afternoon" | "evening" | "night";
export type IntelligenceEngineType = "rules_engine" | "trained_ml" | "hybrid_rules_plus_ml";

export type IntelligenceEngineModelSummary = {
  modelType: "demand" | "retention" | "payment_risk";
  status: "needs_data" | "ready_for_training" | "training" | "trained" | "failed" | "disabled";
  latestVersion: string | null;
  lastTrainedAt: string | null;
  trainingRows: number | null;
  validationRows: number | null;
  metrics: unknown;
  missingRequirements: string[];
};

export type IntelligenceEnginePayloadSummary = {
  type: IntelligenceEngineType;
  dataSource: "first_party_database";
  externalDatasets: "isolated_evaluation_only";
  syntheticProductionData: "none";
  trainedModelInUse: boolean;
  modelStatuses: IntelligenceEngineModelSummary[];
};

export type IntelligenceProduct = {
  id: string | null;
  name: string;
  category?: string | null;
  isAvailable?: boolean;
};

export type IntelligenceOrderItem = {
  productId?: string | null;
  productName: string;
  quantity: number;
  total?: number;
};

export type IntelligenceOrder = {
  id: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  createdAt: Date;
  scheduledFor?: Date | null;
  completedAt?: Date | null;
  orderType?: string;
  items: IntelligenceOrderItem[];
};

export type IntelligenceCustomer = {
  id: string;
  name: string;
  phone: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: Date | null;
  whatsappOptIn: boolean;
  marketingOptIn: boolean;
  preferredProducts?: string[];
};

export type IntelligencePayment = {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  amount: number;
  status: string;
  provider: string;
  createdAt: Date;
  paidAt?: Date | null;
  customerTotalOrders?: number;
  customerTotalSpent?: number;
};

export type DemandForecastResult = {
  productId: string | null;
  productName: string;
  predictedQuantity: number;
  confidence: IntelligenceConfidence;
  confidenceScore: number;
  timeSlot: IntelligenceTimeSlot;
  forecastDate: string;
  reason: string;
  explainability: {
    weekdaySlotAverage: number;
    recentSlotAverage: number;
    weekdayAverage: number;
    overallDailyAverage: number;
    trendAdjustment: number;
    formula: string;
  };
};

export type RepeatCustomerScoreResult = {
  customerId: string;
  customerName: string;
  phone: string;
  score: number;
  segment: string;
  recommendedAction: string;
  daysSinceLastOrder: number | null;
  totalOrders: number;
  totalSpent: number;
  preferredProducts: string[];
  whatsappOptIn: boolean;
  marketingOptIn: boolean;
  scoreBreakdown: {
    recency: number;
    frequency: number;
    monetary: number;
    engagement: number;
  };
};

export type PaymentPriorityResult = {
  paymentId: string;
  orderId: string;
  customerId: string;
  customerName: string;
  phone: string;
  amountPending: number;
  daysOverdue: number;
  customerRepeatValue: number;
  priority: number;
  suggestedMessage: string;
  priorityFactors: {
    amount: number;
    overdue: number;
    customerValue: number;
  };
};

export type BusinessHealthScoreFactor = {
  label: string;
  value: number;
  weight: number;
  contribution: number;
  explanation: string;
};

export type BusinessHealthScoreResult = {
  score: number;
  grade: "A" | "B" | "C" | "D";
  confidence: IntelligenceConfidence;
  confidenceScore: number;
  isPreliminary: boolean;
  observationCount: number;
  salesTrend: number;
  repeatRate: number;
  pendingPaymentRisk: number;
  orderCompletionRate: number;
  activeCustomerRatio: number;
  explanation: string;
  strengths: string[];
  risks: string[];
  nextActions: string[];
  factors: BusinessHealthScoreFactor[];
};

export type NextBestAction = {
  title: string;
  description: string;
  priority: "High" | "Medium" | "Low";
};

export type TopProductTrend = {
  productName: string;
  unitsSold: number;
  repeatBuyers: number;
  trendDirection: "up" | "down" | "stable";
  changePercent: number;
  explanation: string;
};

export type SmartCampaignRecommendation = {
  id: string;
  title: string;
  audience: string;
  timing: string;
  message: string;
  consentNote: string;
  eligibleCustomerCount: number;
  blockedCustomerCount: number;
  productFocus: string;
  reason: string;
  confidence: IntelligenceConfidence;
  whatsappActionLabel: string;
};

export type BusinessIntelligenceDataset = {
  source: IntelligenceSource;
  business: {
    id: string;
    name: string;
    businessType: string;
  };
  products: IntelligenceProduct[];
  orders: IntelligenceOrder[];
  customers: IntelligenceCustomer[];
  payments: IntelligencePayment[];
  now?: Date;
};

export type BusinessIntelligencePayload = {
  source: IntelligenceSource;
  generatedAt: string;
  dataWindow: string;
  business: BusinessIntelligenceDataset["business"];
  engine?: IntelligenceEnginePayloadSummary;
  tomorrowDemandForecast: DemandForecastResult[];
  customerRetentionAlerts: {
    count: number;
    summary: string;
    customers: RepeatCustomerScoreResult[];
  };
  repeatCustomerOpportunities: {
    count: number;
    eligibleCount: number;
    summary: string;
    customers: RepeatCustomerScoreResult[];
  };
  paymentPriorities: PaymentPriorityResult[];
  topProductTrend: TopProductTrend;
  businessHealthScore: BusinessHealthScoreResult;
  nextBestActions: NextBestAction[];
  campaignRecommendations: SmartCampaignRecommendation[];
  campaignRecommendation: SmartCampaignRecommendation;
};

export type BusinessIntelligenceArtifacts = {
  payload: BusinessIntelligencePayload;
  customerScores: RepeatCustomerScoreResult[];
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function isFinalOrActiveOrder(order: IntelligenceOrder) {
  return order.status !== "CANCELLED";
}

function isCompletedPayment(payment: IntelligencePayment) {
  return payment.status === "COMPLETED";
}

function isPendingPayment(payment: IntelligencePayment) {
  return payment.status === "PENDING";
}

function isCompletedOrder(order: IntelligenceOrder) {
  return order.status === "DELIVERED" || order.status === "COMPLETED";
}

function timeSlotForDate(date: Date): IntelligenceTimeSlot {
  const hour = businessHour(date);
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 16) return "afternoon";
  if (hour >= 16 && hour < 21) return "evening";
  return "night";
}

function orderActivityAt(order: IntelligenceOrder) {
  return order.completedAt ?? order.scheduledFor ?? order.createdAt;
}

function confidenceFromScore(score: number): IntelligenceConfidence {
  if (score >= 70) return "High";
  if (score >= 45) return "Medium";
  return "Low";
}

function pluralWeekday(date: Date) {
  const day = weekdayName(date);
  return day.endsWith("s") ? day : `${day}s`;
}

function timeSlotLabel(slot: IntelligenceTimeSlot) {
  if (slot === "morning") return "morning";
  if (slot === "afternoon") return "afternoon";
  if (slot === "evening") return "evening";
  return "late-night";
}

function countWeekdayOccurrences(start: Date, end: Date, weekday: number) {
  let count = 0;
  for (let cursor = startOfDay(start); cursor < startOfDay(end); cursor = addDays(cursor, 1)) {
    if (businessDayOfWeek(cursor) === weekday) count += 1;
  }
  return Math.max(1, count);
}

function productKey(item: IntelligenceOrderItem) {
  return item.productId ?? item.productName.trim().toLowerCase();
}

function productNameFromKey(products: IntelligenceProduct[], key: string, fallback: string) {
  return products.find((product) => product.id === key || product.name.trim().toLowerCase() === key)?.name ?? fallback;
}

export function calculateDemandForecast({
  orders,
  products,
  date,
  timeSlot = "morning",
  windowDays = 30
}: {
  orders: IntelligenceOrder[];
  products: IntelligenceProduct[];
  date: Date;
  dayOfWeek?: number;
  timeSlot?: IntelligenceTimeSlot;
  windowDays?: 7 | 14 | 30 | number;
}): DemandForecastResult[] {
  const targetDate = startOfDay(date);
  const windowStart = addDays(targetDate, -windowDays);
  const last7Start = addDays(targetDate, -7);
  const previous7Start = addDays(targetDate, -14);
  const targetWeekday = businessDayOfWeek(targetDate);
  const weekdayOccurrences = countWeekdayOccurrences(windowStart, targetDate, targetWeekday);
  const stats = new Map<
    string,
    {
      productId: string | null;
      productName: string;
      totalQty: number;
      totalSamples: number;
      recentQty: number;
      recentSamples: number;
      recentSlotQty: number;
      recentSlotSamples: number;
      previousRecentQty: number;
      previousRecentSlotQty: number;
      sameWeekdayQty: number;
      sameWeekdaySamples: number;
      sameWeekdaySlotQty: number;
      sameWeekdaySlotSamples: number;
      slotQty: number;
      slotSamples: number;
    }
  >();

  const ensureStats = (key: string, itemName: string, productId: string | null = null) => {
    const existing = stats.get(key);
    if (existing) return existing;
    const next = {
      productId,
      productName: productNameFromKey(products, key, itemName),
      totalQty: 0,
      totalSamples: 0,
      recentQty: 0,
      recentSamples: 0,
      recentSlotQty: 0,
      recentSlotSamples: 0,
      previousRecentQty: 0,
      previousRecentSlotQty: 0,
      sameWeekdayQty: 0,
      sameWeekdaySamples: 0,
      sameWeekdaySlotQty: 0,
      sameWeekdaySlotSamples: 0,
      slotQty: 0,
      slotSamples: 0
    };
    stats.set(key, next);
    return next;
  };

  products
    .filter((product) => product.isAvailable !== false)
    .forEach((product) => ensureStats(product.id ?? product.name.trim().toLowerCase(), product.name, product.id));

  orders
    .filter((order) => {
      const activityAt = orderActivityAt(order);
      return isFinalOrActiveOrder(order) && activityAt >= windowStart && activityAt < targetDate;
    })
    .forEach((order) => {
      const activityAt = orderActivityAt(order);
      const orderSlot = timeSlotForDate(activityAt);
      const sameWeekday = businessDayOfWeek(activityAt) === targetWeekday;
      const sameSlot = orderSlot === timeSlot;
      const recent = activityAt >= last7Start;
      const previousRecent = activityAt >= previous7Start && activityAt < last7Start;

      order.items.forEach((item) => {
        const key = productKey(item);
        const row = ensureStats(key, item.productName, item.productId ?? null);
        row.totalQty += item.quantity;
        row.totalSamples += 1;

        if (recent) {
          row.recentQty += item.quantity;
          row.recentSamples += 1;
        }

        if (recent && sameSlot) {
          row.recentSlotQty += item.quantity;
          row.recentSlotSamples += 1;
        }

        if (previousRecent) {
          row.previousRecentQty += item.quantity;
        }

        if (previousRecent && sameSlot) {
          row.previousRecentSlotQty += item.quantity;
        }

        if (sameWeekday) {
          row.sameWeekdayQty += item.quantity;
          row.sameWeekdaySamples += 1;
        }

        if (sameSlot) {
          row.slotQty += item.quantity;
          row.slotSamples += 1;
        }

        if (sameWeekday && sameSlot) {
          row.sameWeekdaySlotQty += item.quantity;
          row.sameWeekdaySlotSamples += 1;
        }
      });
    });

  return Array.from(stats.values())
    .map((row) => {
      const overallDailyAvg = row.totalQty / Math.max(1, windowDays);
      const sameWeekdayAvg = row.sameWeekdayQty / weekdayOccurrences;
      const sameWeekdaySlotAvg = row.sameWeekdaySlotQty / weekdayOccurrences;
      const recentSlotAvg = row.recentSlotQty / 7;
      const slotAvg = row.slotQty / Math.max(1, windowDays);
      const slotTrendAdjustment =
        row.recentSlotQty > row.previousRecentSlotQty
          ? 1.08
          : row.recentSlotQty < row.previousRecentSlotQty
            ? 0.94
            : row.recentQty > row.previousRecentQty
              ? 1.04
              : row.recentQty < row.previousRecentQty
                ? 0.97
                : 1;
      const weighted =
        (sameWeekdaySlotAvg * 0.5 + recentSlotAvg * 0.25 + sameWeekdayAvg * 0.15 + slotAvg * 0.06 + overallDailyAvg * 0.04) *
        slotTrendAdjustment;
      const confidenceScore = clamp(
        row.sameWeekdaySlotSamples * 18 + row.recentSlotSamples * 8 + row.sameWeekdaySamples * 4 + row.totalSamples * 1.25,
        0,
        100
      );
      const predictedQuantity = Math.max(0, Math.round(weighted));
      const slotLabel = timeSlotLabel(timeSlot);

      return {
        productId: row.productId,
        productName: row.productName,
        predictedQuantity,
        confidence: confidenceFromScore(confidenceScore),
        confidenceScore: Math.round(confidenceScore),
        timeSlot,
        forecastDate: targetDate.toISOString(),
        reason: `Weighted moving average for ${pluralWeekday(targetDate)} ${slotLabel}: weekday-slot 50%, recent-slot 25%, weekday 15%, same-slot 6%, overall 4%.`,
        explainability: {
          weekdaySlotAverage: round(sameWeekdaySlotAvg, 1),
          recentSlotAverage: round(recentSlotAvg, 1),
          weekdayAverage: round(sameWeekdayAvg, 1),
          overallDailyAverage: round(overallDailyAvg, 1),
          trendAdjustment: round(slotTrendAdjustment, 2),
          formula: "0.50 weekday-slot + 0.25 recent-slot + 0.15 weekday + 0.06 same-slot + 0.04 overall"
        }
      };
    })
    .filter((forecast) => forecast.predictedQuantity > 0 && forecast.confidenceScore >= 8)
    .sort((first, second) => second.predictedQuantity - first.predictedQuantity)
    .slice(0, 6);
}

function preferredProductsForCustomer(customer: IntelligenceCustomer, orders: IntelligenceOrder[]) {
  if (customer.preferredProducts?.length) return customer.preferredProducts.slice(0, 3);

  const productCounts = new Map<string, number>();
  orders
    .filter((order) => order.customerId === customer.id && isFinalOrActiveOrder(order))
    .forEach((order) => {
      order.items.forEach((item) => {
        productCounts.set(item.productName, (productCounts.get(item.productName) ?? 0) + item.quantity);
      });
    });

  return Array.from(productCounts.entries())
    .sort((first, second) => second[1] - first[1])
    .slice(0, 3)
    .map(([name]) => name);
}

export function calculateRepeatCustomerScore({
  customers,
  orders = [],
  now = new Date()
}: {
  customers: IntelligenceCustomer[];
  orders?: IntelligenceOrder[];
  now?: Date;
}): RepeatCustomerScoreResult[] {
  return customers
    .map((customer) => {
      const daysSinceLastOrder = customer.lastOrderAt ? daysBetween(customer.lastOrderAt, now) : null;
      const recencyScore =
        daysSinceLastOrder === null
          ? 0
          : daysSinceLastOrder <= 3
            ? 35
            : daysSinceLastOrder <= 7
              ? 30
              : daysSinceLastOrder <= 14
                ? 22
                : daysSinceLastOrder <= 30
                  ? 12
                  : 4;
      const frequencyScore = clamp(customer.totalOrders * 4, 0, 30);
      const monetaryScore = clamp(customer.totalSpent / 500, 0, 25);
      const engagementScore = customer.marketingOptIn ? 10 : customer.whatsappOptIn ? 5 : 0;
      const score = Math.round(clamp(recencyScore + frequencyScore + monetaryScore + engagementScore, 0, 100));
      const preferredProducts = preferredProductsForCustomer(customer, orders);

      let segment = "Watchlist";
      if (!customer.marketingOptIn && !customer.whatsappOptIn) segment = "Consent needed";
      else if (daysSinceLastOrder !== null && daysSinceLastOrder > 30 && customer.totalOrders >= 2) segment = "Churn risk";
      else if (daysSinceLastOrder !== null && daysSinceLastOrder >= 5 && daysSinceLastOrder <= 14 && customer.marketingOptIn) segment = "Reminder opportunity";
      else if (daysSinceLastOrder !== null && daysSinceLastOrder <= 5 && customer.totalOrders >= 5) segment = "Loyal active";

      const preferred = preferredProducts[0] ?? "their usual order";
      const recommendedAction = customer.marketingOptIn
        ? `Send a consent-safe WhatsApp reminder for ${preferred}.`
        : customer.whatsappOptIn
          ? "Use only order/status communication and ask for separate marketing consent before sending offers."
          : "Do not send marketing messages until the customer opts in.";

      return {
        customerId: customer.id,
        customerName: customer.name,
        phone: customer.phone,
        score,
        segment,
        recommendedAction,
        daysSinceLastOrder,
        totalOrders: customer.totalOrders,
        totalSpent: customer.totalSpent,
        preferredProducts,
        whatsappOptIn: customer.whatsappOptIn,
        marketingOptIn: customer.marketingOptIn,
        scoreBreakdown: {
          recency: Math.round(recencyScore),
          frequency: Math.round(frequencyScore),
          monetary: Math.round(monetaryScore),
          engagement: Math.round(engagementScore)
        }
      };
    })
    .sort((first, second) => second.score - first.score);
}

export function calculatePaymentPriority({
  payments,
  now = new Date()
}: {
  payments: IntelligencePayment[];
  now?: Date;
}): PaymentPriorityResult[] {
  const pendingPayments = payments.filter(isPendingPayment);
  const maxPendingAmount = Math.max(1, ...pendingPayments.map((payment) => payment.amount));

  return pendingPayments
    .map((payment) => {
      const daysOverdue = Math.max(0, daysBetween(payment.createdAt, now));
      const amountWeight = (payment.amount / maxPendingAmount) * 40;
      const overdueDaysWeight = clamp(daysOverdue * 8, 0, 35);
      const repeatCustomerWeight = clamp((payment.customerTotalOrders ?? 0) * 3 + (payment.customerTotalSpent ?? 0) / 1000, 0, 25);
      const priority = Math.round(clamp(amountWeight + overdueDaysWeight + repeatCustomerWeight, 0, 100));
      const suggestedMessage = `Namaste ${payment.customerName}, your payment of Rs. ${Math.round(payment.amount)} is pending for order ${payment.orderId}. Please complete it from the secure payment link when convenient.`;

      return {
        paymentId: payment.id,
        orderId: payment.orderId,
        customerId: payment.customerId,
        customerName: payment.customerName,
        phone: payment.customerPhone,
        amountPending: payment.amount,
        daysOverdue,
        customerRepeatValue: Math.round(repeatCustomerWeight),
        priority,
        suggestedMessage,
        priorityFactors: {
          amount: Math.round(amountWeight),
          overdue: Math.round(overdueDaysWeight),
          customerValue: Math.round(repeatCustomerWeight)
        }
      };
    })
    .sort((first, second) => second.priority - first.priority);
}

export function calculateBusinessHealthScore({
  weeklySales,
  previousWeekSales,
  repeatCustomers,
  totalCustomers,
  pendingPaymentsAmount,
  pendingPaymentsCount,
  completedOrders,
  cancelledOrders,
  activeCustomers,
  observationCount = 0,
  historyDays = 0,
  paymentObservationCount = 0
}: {
  weeklySales: number;
  previousWeekSales: number;
  repeatCustomers: number;
  totalCustomers: number;
  pendingPaymentsAmount: number;
  pendingPaymentsCount: number;
  completedOrders: number;
  cancelledOrders: number;
  activeCustomers: number;
  observationCount?: number;
  historyDays?: number;
  paymentObservationCount?: number;
}): BusinessHealthScoreResult {
  const totalTerminalOrders = completedOrders + cancelledOrders;
  const salesTrend = previousWeekSales === 0 ? (weeklySales > 0 ? 100 : 0) : round(((weeklySales - previousWeekSales) / previousWeekSales) * 100);
  const repeatRate = totalCustomers ? round((repeatCustomers / totalCustomers) * 100) : 0;
  const pendingPaymentRisk = weeklySales > 0 ? round((pendingPaymentsAmount / weeklySales) * 100) : pendingPaymentsAmount > 0 ? 100 : 0;
  const orderCompletionRate = totalTerminalOrders ? round((completedOrders / totalTerminalOrders) * 100) : 100;
  const activeCustomerRatio = totalCustomers ? round((activeCustomers / totalCustomers) * 100) : 0;

  const salesComponent = salesTrend >= 15 ? 20 : salesTrend >= 0 ? 16 : salesTrend >= -10 ? 10 : 5;
  const repeatComponent = clamp((repeatRate / 60) * 25, 0, 25);
  const paymentComponent = pendingPaymentRisk <= 5 ? 20 : pendingPaymentRisk <= 15 ? 15 : pendingPaymentRisk <= 30 ? 10 : 5;
  const completionComponent = clamp((orderCompletionRate / 100) * 20, 0, 20);
  const activeCustomerComponent = clamp((activeCustomerRatio / 70) * 15, 0, 15);
  const score = Math.round(clamp(salesComponent + repeatComponent + paymentComponent + completionComponent + activeCustomerComponent, 0, 100));
  const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : "D";
  const confidenceScore = Math.round(
    clamp(
      Math.min(1, observationCount / 50) * 40 +
      Math.min(1, totalCustomers / 30) * 25 +
      Math.min(1, paymentObservationCount / 30) * 15 +
      Math.min(1, historyDays / 30) * 20,
      0,
      100
    )
  );
  const confidence: IntelligenceConfidence = confidenceScore >= 80 ? "High" : confidenceScore >= 50 ? "Medium" : "Low";
  const factors: BusinessHealthScoreFactor[] = [
    {
      label: "Sales trend",
      value: salesTrend,
      weight: 20,
      contribution: round(salesComponent, 1),
      explanation: salesTrend >= 0 ? "Sales are stable or ahead of last week." : "Sales are behind last week."
    },
    {
      label: "Repeat rate",
      value: repeatRate,
      weight: 25,
      contribution: round(repeatComponent, 1),
      explanation: `${round(repeatRate)}% of customers have ordered more than once.`
    },
    {
      label: "Pending payment risk",
      value: pendingPaymentRisk,
      weight: 20,
      contribution: round(paymentComponent, 1),
      explanation: pendingPaymentRisk <= 15 ? "Pending dues are manageable against weekly sales." : "Pending dues are high against weekly sales."
    },
    {
      label: "Completion rate",
      value: orderCompletionRate,
      weight: 20,
      contribution: round(completionComponent, 1),
      explanation: `${round(orderCompletionRate)}% of terminal orders were completed.`
    },
    {
      label: "Active customer ratio",
      value: activeCustomerRatio,
      weight: 15,
      contribution: round(activeCustomerComponent, 1),
      explanation: `${round(activeCustomerRatio)}% of customers were active in the last 30 days.`
    }
  ];
  const strengths: string[] = [];
  const risks: string[] = [];

  if (salesTrend >= 0) strengths.push("Sales trend is stable or improving this week.");
  else risks.push("Weekly sales are below the previous week.");

  if (repeatRate >= 35) strengths.push("Repeat customer rate is healthy for a local MSME.");
  else risks.push("Repeat customer activity needs attention.");

  if (pendingPaymentRisk <= 15) strengths.push("Pending payment exposure is under control.");
  else risks.push("Pending payments are high compared with weekly sales.");

  if (orderCompletionRate >= 90) strengths.push("Order completion is strong.");
  else risks.push("Cancelled or incomplete orders are affecting reliability.");

  const nextActions: string[] = [];
  if (pendingPaymentsCount > 0) nextActions.push("Review pending payments and follow up with the highest-priority customers first.");
  if (repeatRate < 35) nextActions.push("Create a consent-safe reminder for customers who ordered recently but have gone quiet.");
  if (salesTrend < 0) nextActions.push("Promote the top repeat item in the next active time slot.");
  if (nextActions.length === 0) nextActions.push("Maintain the current operating rhythm and monitor demand before the next rush slot.");

  const positivePart = repeatRate >= 35 ? "Repeat orders are strong" : salesTrend >= 0 ? "Sales are holding steady" : "The business has usable operating data";
  const riskPart = pendingPaymentRisk > 15 ? "pending payments increased this week" : repeatRate < 35 ? "repeat engagement can improve" : "payment and completion risk look controlled";

  return {
    score,
    grade,
    confidence,
    confidenceScore,
    isPreliminary: confidence !== "High",
    observationCount,
    salesTrend,
    repeatRate,
    pendingPaymentRisk,
    orderCompletionRate,
    activeCustomerRatio,
    explanation: `Your business health is ${score}/100. ${positivePart}, but ${riskPart}.`,
    strengths,
    risks,
    nextActions,
    factors
  };
}

function sumCompletedPayments(payments: IntelligencePayment[], start: Date, end: Date) {
  return payments
    .filter((payment) => isCompletedPayment(payment) && payment.createdAt >= start && payment.createdAt < end)
    .reduce((sum, payment) => sum + payment.amount, 0);
}

function calculateTopProductTrend(orders: IntelligenceOrder[], now: Date): TopProductTrend {
  const currentStart = addDays(startOfDay(now), -7);
  const previousStart = addDays(startOfDay(now), -14);
  const productStats = new Map<
    string,
    {
      productName: string;
      currentQty: number;
      previousQty: number;
      customerPurchases: Map<string, number>;
    }
  >();

  orders
    .filter((order) => {
      const activityAt = orderActivityAt(order);
      return isFinalOrActiveOrder(order) && activityAt >= previousStart && activityAt < now;
    })
    .forEach((order) => {
      const activityAt = orderActivityAt(order);
      order.items.forEach((item) => {
        const key = item.productName.trim().toLowerCase();
        const row =
          productStats.get(key) ??
          {
            productName: item.productName,
            currentQty: 0,
            previousQty: 0,
            customerPurchases: new Map<string, number>()
          };
        if (activityAt >= currentStart) row.currentQty += item.quantity;
        else row.previousQty += item.quantity;
        row.customerPurchases.set(order.customerId, (row.customerPurchases.get(order.customerId) ?? 0) + item.quantity);
        productStats.set(key, row);
      });
    });

  const top = Array.from(productStats.values()).sort((first, second) => second.currentQty - first.currentQty)[0];

  if (!top) {
    return {
      productName: "No product trend yet",
      unitsSold: 0,
      repeatBuyers: 0,
      trendDirection: "stable",
      changePercent: 0,
      explanation: "Add orders to identify repeat product trends."
    };
  }

  const changePercent = top.previousQty === 0 ? (top.currentQty > 0 ? 100 : 0) : Math.round(((top.currentQty - top.previousQty) / top.previousQty) * 100);
  const repeatBuyers = Array.from(top.customerPurchases.values()).filter((quantity) => quantity > 1).length;
  const trendDirection = changePercent > 8 ? "up" : changePercent < -8 ? "down" : "stable";

  return {
    productName: top.productName,
    unitsSold: top.currentQty,
    repeatBuyers,
    trendDirection,
    changePercent,
    explanation: `${top.productName} sold ${top.currentQty} units this week with ${repeatBuyers} repeat buyers.`
  };
}

function businessActivityLabel(businessType: string) {
  const normalized = businessType.toLowerCase();
  if (/(tiffin|restaurant|cloud|food|cafe|breakfast)/.test(normalized)) return "breakfast";
  if (/(salon|spa|fitness|service|repair|home)/.test(normalized)) return "services";
  if (/(grocery|pharmacy|retail|store)/.test(normalized)) return "essentials";
  return "recent orders";
}

function generateSmartCampaignRecommendations({
  demandForecast,
  repeatCustomers,
  businessType
}: {
  demandForecast: DemandForecastResult[];
  repeatCustomers: RepeatCustomerScoreResult[];
  businessType: string;
}): SmartCampaignRecommendation[] {
  const activityLabel = businessActivityLabel(businessType);
  const reminderOpportunities = repeatCustomers.filter(
    (customer) =>
      customer.marketingOptIn &&
      customer.daysSinceLastOrder !== null &&
      customer.daysSinceLastOrder >= 5 &&
      customer.daysSinceLastOrder <= 14
  );
  const consentBlocked = repeatCustomers.filter((customer) => !customer.marketingOptIn);
  const churnRisks = repeatCustomers.filter((customer) => customer.marketingOptIn && customer.segment === "Churn risk");
  const topForecast = demandForecast[0];
  const preferredProduct =
    reminderOpportunities[0]?.preferredProducts[0] ??
    topForecast?.productName ??
    "their usual order";

  const campaigns: SmartCampaignRecommendation[] = [
    {
      id: "repeat-reminder",
      title: "Repeat customer WhatsApp reminder",
      audience: `${reminderOpportunities.length} opted-in customers who ordered ${activityLabel} recently but have gone quiet`,
      timing: topForecast?.timeSlot === "evening" ? "Send tomorrow between 4:30 PM and 6:30 PM." : "Send tomorrow between 6:30 AM and 8:30 AM.",
      message: `Hi {{customer_name}}, ${preferredProduct} is available tomorrow. Reply here if you want us to keep it ready for you.`,
      consentNote:
        consentBlocked.length > 0
          ? `Send only to ${reminderOpportunities.length} customers with marketing consent. Do not send offers to ${consentBlocked.length} customers without consent.`
          : "All selected customers have marketing consent for this reminder.",
      eligibleCustomerCount: reminderOpportunities.length,
      blockedCustomerCount: consentBlocked.length,
      productFocus: preferredProduct,
      reason: "RFM score shows these customers bought recently, have repeat value, and are due for a gentle reminder.",
      confidence: reminderOpportunities.length >= 5 ? "High" : reminderOpportunities.length >= 2 ? "Medium" : "Low",
      whatsappActionLabel: "Create reminder"
    }
  ];

  if (topForecast) {
    const eligibleCount = repeatCustomers.filter((customer) => customer.marketingOptIn && customer.preferredProducts.includes(topForecast.productName)).length;
    campaigns.push({
      id: "forecast-product-push",
      title: `${topForecast.productName} demand nudge`,
      audience: `${eligibleCount} opted-in customers with ${topForecast.productName} preference`,
      timing: `Send before the ${timeSlotLabel(topForecast.timeSlot)} slot tomorrow.`,
      message: `Hi {{customer_name}}, ${topForecast.productName} is likely to move fast tomorrow ${timeSlotLabel(topForecast.timeSlot)}. Reply to reserve yours.`,
      consentNote: "Use this only for customers who opted into marketing WhatsApp messages.",
      eligibleCustomerCount: eligibleCount,
      blockedCustomerCount: consentBlocked.length,
      productFocus: topForecast.productName,
      reason: topForecast.reason,
      confidence: topForecast.confidence,
      whatsappActionLabel: "Draft product reminder"
    });
  }

  if (churnRisks.length > 0) {
    const focus = churnRisks[0]?.preferredProducts[0] ?? "their regular item";
    campaigns.push({
      id: "churn-save",
      title: "Win-back reminder",
      audience: `${churnRisks.length} opted-in repeat customers inactive for 30+ days`,
      timing: "Send during a slower business hour so replies can be handled quickly.",
      message: `Hi {{customer_name}}, we missed serving you. ${focus} is available again this week if you would like to order.`,
      consentNote: "Send only to opted-in repeat customers; skip anyone without marketing consent.",
      eligibleCustomerCount: churnRisks.length,
      blockedCustomerCount: consentBlocked.length,
      productFocus: focus,
      reason: "These customers have repeat purchase value but have not returned recently.",
      confidence: churnRisks.length >= 3 ? "Medium" : "Low",
      whatsappActionLabel: "Prepare win-back"
    });
  }

  return campaigns;
}

export function generateNextBestActions({
  demandForecast,
  repeatCustomers,
  paymentPriorities,
  businessHealth,
  topProductTrend
}: {
  demandForecast: DemandForecastResult[];
  repeatCustomers: RepeatCustomerScoreResult[];
  paymentPriorities: PaymentPriorityResult[];
  businessHealth: BusinessHealthScoreResult;
  topProductTrend: TopProductTrend;
}): NextBestAction[] {
  const actions: NextBestAction[] = [];
  const topForecast = demandForecast[0];
  const repeatOpportunities = repeatCustomers.filter((customer) => customer.segment === "Reminder opportunity");
  const topPayment = paymentPriorities[0];

  if (topForecast) {
    const extraUnits = Math.max(1, Math.ceil(topForecast.predictedQuantity * 0.15));
    actions.push({
      title: `Prepare extra ${topForecast.productName}`,
      description: `Prepare around ${extraUnits} extra units tomorrow ${topForecast.timeSlot} because forecast demand is ${topForecast.predictedQuantity}.`,
      priority: topForecast.confidence === "High" ? "High" : "Medium"
    });
  }

  if (repeatOpportunities.length > 0) {
    actions.push({
      title: "Send repeat customer reminder",
      description: `Message ${repeatOpportunities.length} opted-in customers who ordered recently but have not returned in the last 5 days.`,
      priority: "High"
    });
  }

  if (topPayment) {
    actions.push({
      title: "Follow up pending payments",
      description: `Start with ${topPayment.customerName}, where Rs. ${Math.round(topPayment.amountPending)} is pending for ${topPayment.daysOverdue} days.`,
      priority: topPayment.priority >= 70 ? "High" : "Medium"
    });
  }

  if (topProductTrend.unitsSold > 0) {
    actions.push({
      title: `Promote ${topProductTrend.productName}`,
      description: `Use ${topProductTrend.productName} in the next campaign because it has ${topProductTrend.repeatBuyers} repeat buyers this week.`,
      priority: topProductTrend.trendDirection === "up" ? "High" : "Medium"
    });
  }

  if (businessHealth.score < 70) {
    actions.push({
      title: "Review business health risks",
      description: businessHealth.risks[0] ?? "Review pending payments, repeat rate, and order completion before the next rush slot.",
      priority: "Medium"
    });
  }

  return actions.slice(0, 5);
}

export function buildBusinessIntelligenceArtifacts(dataset: BusinessIntelligenceDataset): BusinessIntelligenceArtifacts {
  const now = dataset.now ?? new Date();
  const tomorrow = addDays(startOfDay(now), 1);
  const currentWeekStart = addDays(startOfDay(now), -7);
  const previousWeekStart = addDays(startOfDay(now), -14);
  const activeCustomerStart = addDays(startOfDay(now), -30);
  const orders = dataset.orders.filter((order) => isFinalOrActiveOrder(order));
  const customers = dataset.customers;
  const pendingPayments = dataset.payments.filter(isPendingPayment);

  const demandForecast = (["morning", "afternoon", "evening", "night"] as IntelligenceTimeSlot[])
    .flatMap((slot) => {
      const forecastDate = atBusinessHour(tomorrow, slot === "morning" ? 8 : slot === "afternoon" ? 13 : slot === "evening" ? 18 : 22);
      return calculateDemandForecast({
        orders,
        products: dataset.products,
        date: forecastDate,
        timeSlot: slot,
        windowDays: 30
      }).slice(0, 4);
    })
    .sort((first, second) => second.predictedQuantity - first.predictedQuantity || second.confidenceScore - first.confidenceScore)
    .slice(0, 8);
  const repeatScores = calculateRepeatCustomerScore({ customers, orders, now });
  const paymentPriorities = calculatePaymentPriority({ payments: dataset.payments, now });
  const repeatOpportunities = repeatScores.filter(
    (customer) =>
      customer.marketingOptIn &&
      customer.daysSinceLastOrder !== null &&
      customer.daysSinceLastOrder >= 5 &&
      customer.daysSinceLastOrder <= 14
  );
  const customerRetentionAlerts = repeatScores.filter(
    (customer) =>
      customer.segment === "Churn risk" ||
      (customer.daysSinceLastOrder !== null && customer.daysSinceLastOrder >= 15 && customer.totalOrders >= 2)
  );
  const topProductTrend = calculateTopProductTrend(orders, now);
  const completedOrders = dataset.orders.filter(isCompletedOrder).length;
  const cancelledOrders = dataset.orders.filter((order) => order.status === "CANCELLED").length;
  const activeCustomers = customers.filter((customer) => customer.lastOrderAt && customer.lastOrderAt >= activeCustomerStart).length;
  const repeatCustomers = customers.filter((customer) => customer.totalOrders > 1).length;
  const weeklySales = sumCompletedPayments(dataset.payments, currentWeekStart, now);
  const previousWeekSales = sumCompletedPayments(dataset.payments, previousWeekStart, currentWeekStart);
  const pendingPaymentsAmount = pendingPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const orderActivityDates = dataset.orders.map(orderActivityAt).sort((first, second) => first.getTime() - second.getTime());
  const historyDays = orderActivityDates.length
    ? daysBetween(orderActivityDates[0]!, orderActivityDates[orderActivityDates.length - 1]!) + 1
    : 0;
  const businessHealth = calculateBusinessHealthScore({
    weeklySales,
    previousWeekSales,
    repeatCustomers,
    totalCustomers: customers.length,
    pendingPaymentsAmount,
    pendingPaymentsCount: pendingPayments.length,
    completedOrders,
    cancelledOrders,
    activeCustomers,
    observationCount: dataset.orders.length,
    historyDays,
    paymentObservationCount: dataset.payments.length
  });
  const nextBestActions = generateNextBestActions({
    demandForecast,
    repeatCustomers: repeatScores,
    paymentPriorities,
    businessHealth,
    topProductTrend
  });
  const activityLabel = businessActivityLabel(dataset.business.businessType);
  const eligibleCount = repeatScores.filter((customer) => customer.marketingOptIn).length;
  const campaignRecommendations = generateSmartCampaignRecommendations({
    demandForecast,
    repeatCustomers: repeatScores,
    businessType: dataset.business.businessType
  });

  return {
    customerScores: repeatScores,
    payload: {
    source: dataset.source,
    generatedAt: now.toISOString(),
    dataWindow: dataset.source === "demo" ? "Demo sample data" : "Last 45 days",
    business: dataset.business,
    tomorrowDemandForecast: demandForecast,
    customerRetentionAlerts: {
      count: customerRetentionAlerts.length,
      summary: `${customerRetentionAlerts.length} repeat customers may need retention follow-up based on recency and order history.`,
      customers: customerRetentionAlerts.slice(0, 8)
    },
    repeatCustomerOpportunities: {
      count: repeatOpportunities.length,
      eligibleCount,
      summary: `${repeatOpportunities.length} customers ordered ${activityLabel} in the last 14 days but have not ordered in the last 5 days.`,
      customers: repeatOpportunities.length ? repeatOpportunities.slice(0, 8) : repeatScores.slice(0, 8)
    },
    paymentPriorities: paymentPriorities.slice(0, 8),
    topProductTrend,
    businessHealthScore: businessHealth,
    nextBestActions,
    campaignRecommendations,
    campaignRecommendation: campaignRecommendations[0]
    }
  };
}

export function buildBusinessIntelligencePayload(dataset: BusinessIntelligenceDataset): BusinessIntelligencePayload {
  return buildBusinessIntelligenceArtifacts(dataset).payload;
}
