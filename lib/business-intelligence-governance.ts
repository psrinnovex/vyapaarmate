import type { BusinessIntelligenceDataset, IntelligenceOrder } from "@/lib/business-intelligence";
import { getBusinessIntelligenceDataset } from "@/lib/business-intelligence-data";
import { intelligenceBenchmarkDatasets, productionTrainingOrigins } from "@/lib/intelligence/benchmark-datasets";
import {
  businessDateKey as dateKey,
  businessDaysBetween as daysBetween
} from "@/lib/intelligence/intelligence-time";
import { buildEngineSummary, intelligenceModelTypes, type PersistedModelStatus } from "@/lib/intelligence/ml/model-registry";
import { getIntelligenceModelStatuses } from "@/lib/intelligence/ml/training-service";

export type IntelligenceReadinessStatus = "ready" | "needs_data" | "blocked";
export type IntelligenceQualityStatus = "pass" | "warning" | "fail";

export type IntelligenceDataSource = {
  id: string;
  name: string;
  storage: string;
  sourceType: "first_party_operational" | "derived_output" | "synthetic_fixture" | "external_optional";
  recordCount: number;
  fieldsUsed: string[];
  usedFor: string[];
  containsPersonalData: boolean;
  trainingRole: "runtime_feature" | "future_training_label" | "evaluation_only" | "not_used_for_training";
  notes: string;
};

export type IntelligenceDatasetProfile = {
  source: BusinessIntelligenceDataset["source"];
  isDemoFallback: boolean;
  generatedAt: string;
  orderHistory: {
    orders: number;
    completedOrders: number;
    cancelledOrders: number;
    orderItems: number;
    linkedOrderItems: number;
    linkedOrderItemRate: number | null;
    uniqueOrderDates: number;
    historyDays: number;
    earliestOrderAt: string | null;
    latestOrderAt: string | null;
    latestOrderAgeDays: number | null;
  };
  customers: {
    total: number;
    withLastOrder: number;
    whatsappOptIn: number;
    marketingOptIn: number;
    repeatCustomers: number;
  };
  payments: {
    total: number;
    completed: number;
    pending: number;
    failed: number;
    paidWithTimestamp: number;
  };
};

export type IntelligenceQualityCheck = {
  id: string;
  label: string;
  status: IntelligenceQualityStatus;
  value: string;
  recommendation: string;
};

export type IntelligenceReadinessGate = {
  id: string;
  label: string;
  status: IntelligenceReadinessStatus;
  score: number;
  minimumDataNeeded: string;
  reason: string;
};

export type BusinessIntelligenceGovernanceReport = {
  generatedAt: string;
  business: BusinessIntelligenceDataset["business"];
  currentEngine: {
    type: "rules_engine" | "trained_ml" | "hybrid_rules_plus_ml";
    trainedModelInUse: boolean;
    dataSource: "first_party_database";
    externalDatasets: "isolated_evaluation_only";
    syntheticProductionData: "none";
    usesExternalDatasets: false;
    summary: string;
  };
  modelStatus: Array<{
    modelType: "demand" | "retention" | "payment_risk";
    status: "needs_data" | "ready_for_training" | "training" | "shadow" | "trained" | "failed" | "disabled";
    latestVersion: string | null;
    trainedAt: string | null;
    trainingRows: number | null;
    validationRows: number | null;
    metrics: PersistedModelStatus["latestMetrics"];
    confidence: string;
    missingRequirements: string[];
    limitations: string[];
  }>;
  datasetProfile: IntelligenceDatasetProfile;
  dataSources: IntelligenceDataSource[];
  qualityChecks: IntelligenceQualityCheck[];
  readiness: {
    overallStatus: IntelligenceReadinessStatus;
    gates: IntelligenceReadinessGate[];
  };
  trainingPlan: {
    currentTrainingStatus: "not_training";
    approvedTrainingSource: string;
    developmentDataset: string;
    externalDatasets: Array<{
      name: string;
      status: "evaluation_only" | "excluded_duplicate" | "incomplete";
      purpose: string;
    }>;
    futureLabels: Array<{
      label: string;
      builtFrom: string;
      useCase: string;
    }>;
    privacyControls: string[];
  };
  maintenance: {
    ownerReviewCadence: string;
    accuracyEndpoint: string;
    recommendedActions: string[];
  };
};

function round(value: number, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function isCompletedOrder(order: IntelligenceOrder) {
  return order.status === "DELIVERED" || order.status === "COMPLETED";
}

function orderActivityAt(order: IntelligenceOrder) {
  return order.completedAt ?? order.scheduledFor ?? order.createdAt;
}

function qualityStatus(value: number, passAt: number, warnAt: number): IntelligenceQualityStatus {
  if (value >= passAt) return "pass";
  if (value >= warnAt) return "warning";
  return "fail";
}

function readinessStatus(blocked: boolean, ready: boolean): IntelligenceReadinessStatus {
  if (blocked) return "blocked";
  return ready ? "ready" : "needs_data";
}

function buildDatasetProfile(dataset: BusinessIntelligenceDataset): IntelligenceDatasetProfile {
  const now = dataset.now ?? new Date();
  const orders = dataset.orders;
  const orderItems = orders.flatMap((order) => order.items);
  const linkedOrderItems = orderItems.filter((item) => Boolean(item.productId)).length;
  const orderDates = new Set(orders.map((order) => dateKey(orderActivityAt(order))));
  const orderTimes = orders.map((order) => orderActivityAt(order).getTime());
  const earliestOrderAt = orderTimes.length ? new Date(Math.min(...orderTimes)) : null;
  const latestOrderAt = orderTimes.length ? new Date(Math.max(...orderTimes)) : null;
  const completedOrders = orders.filter(isCompletedOrder).length;
  const cancelledOrders = orders.filter((order) => order.status === "CANCELLED").length;
  const completedPayments = dataset.payments.filter((payment) => payment.status === "COMPLETED" || payment.status === "PAID").length;
  const pendingPayments = dataset.payments.filter((payment) => payment.status === "PENDING").length;
  const failedPayments = dataset.payments.filter((payment) => payment.status === "FAILED").length;

  return {
    source: dataset.source,
    isDemoFallback: dataset.source === "demo",
    generatedAt: now.toISOString(),
    orderHistory: {
      orders: orders.length,
      completedOrders,
      cancelledOrders,
      orderItems: orderItems.length,
      linkedOrderItems,
      linkedOrderItemRate: orderItems.length ? round((linkedOrderItems / orderItems.length) * 100, 2) : null,
      uniqueOrderDates: orderDates.size,
      historyDays: earliestOrderAt && latestOrderAt ? daysBetween(earliestOrderAt, latestOrderAt) + 1 : 0,
      earliestOrderAt: earliestOrderAt?.toISOString() ?? null,
      latestOrderAt: latestOrderAt?.toISOString() ?? null,
      latestOrderAgeDays: latestOrderAt ? daysBetween(latestOrderAt, now) : null
    },
    customers: {
      total: dataset.customers.length,
      withLastOrder: dataset.customers.filter((customer) => customer.lastOrderAt).length,
      whatsappOptIn: dataset.customers.filter((customer) => customer.whatsappOptIn).length,
      marketingOptIn: dataset.customers.filter((customer) => customer.marketingOptIn).length,
      repeatCustomers: dataset.customers.filter((customer) => customer.totalOrders >= 2).length
    },
    payments: {
      total: dataset.payments.length,
      completed: completedPayments,
      pending: pendingPayments,
      failed: failedPayments,
      paidWithTimestamp: dataset.payments.filter((payment) => payment.paidAt).length
    }
  };
}

function buildDataSources(dataset: BusinessIntelligenceDataset, profile: IntelligenceDatasetProfile): IntelligenceDataSource[] {
  return [
    {
      id: "business_profile",
      name: "Business profile",
      storage: "Business",
      sourceType: "first_party_operational",
      recordCount: 1,
      fieldsUsed: ["id", "name", "businessType"],
      usedFor: ["business context", "industry-specific wording", "fallback demo selection"],
      containsPersonalData: false,
      trainingRole: "runtime_feature",
      notes: "Loaded from the merchant's own business record."
    },
    {
      id: "catalog",
      name: "Product or service catalog",
      storage: "MenuItem, MenuCategory",
      sourceType: "first_party_operational",
      recordCount: dataset.products.length,
      fieldsUsed: ["id", "name", "category", "isAvailable"],
      usedFor: ["demand forecasts", "top product signals", "campaign product focus"],
      containsPersonalData: false,
      trainingRole: "runtime_feature",
      notes: "Clean item links improve product-level forecast accuracy."
    },
    {
      id: "orders",
      name: "Order history",
      storage: "Order, OrderItem",
      sourceType: "first_party_operational",
      recordCount: profile.orderHistory.orders,
      fieldsUsed: ["status", "paymentStatus", "totalAmount", "createdAt", "scheduledFor", "completedAt", "orderType", "itemName", "quantity", "menuItemId"],
      usedFor: ["sales trends", "demand forecasts", "repeat behavior", "product performance", "accuracy backtests"],
      containsPersonalData: false,
      trainingRole: "future_training_label",
      notes: "This is the primary source for forecast labels and sales behavior."
    },
    {
      id: "customers",
      name: "Customer activity and consent",
      storage: "Customer",
      sourceType: "first_party_operational",
      recordCount: profile.customers.total,
      fieldsUsed: ["id", "name", "phone", "totalOrders", "totalSpent", "lastOrderAt", "whatsappOptIn", "marketingOptIn"],
      usedFor: ["retention alerts", "repeat-customer opportunities", "campaign eligibility"],
      containsPersonalData: true,
      trainingRole: "runtime_feature",
      notes: "Name and phone are used only for owner-facing action lists and should be excluded or tokenized before ML training."
    },
    {
      id: "payments",
      name: "Payment state and settlement timing",
      storage: "Payment",
      sourceType: "first_party_operational",
      recordCount: profile.payments.total,
      fieldsUsed: ["amount", "status", "provider", "createdAt", "paidAt", "updatedAt", "orderId"],
      usedFor: ["payment risk", "collection priority", "business health"],
      containsPersonalData: false,
      trainingRole: "future_training_label",
      notes: "Payment timestamps become labels for delay and collection-risk models once enough history exists."
    },
    {
      id: "materialized_intelligence",
      name: "Materialized intelligence outputs",
      storage: "AIInsight, BusinessHealthSnapshot, CustomerIntelligenceScore, DemandForecast, PaymentPriority",
      sourceType: "derived_output",
      recordCount: 0,
      fieldsUsed: ["score", "confidence", "reason", "recommendedAction", "createdAt"],
      usedFor: ["dashboard display", "auditing generated recommendations", "weekly review"],
      containsPersonalData: true,
      trainingRole: "evaluation_only",
      notes: "These rows are outputs of the engine, not raw training data. They should not be used as labels without human review."
    },
    {
      id: "development_fixture",
      name: "Synthetic development fixture",
      storage: "lib/business-intelligence.test.ts",
      sourceType: "synthetic_fixture",
      recordCount: 1,
      fieldsUsed: ["synthetic orders", "synthetic customers", "synthetic payments"],
      usedFor: ["unit tests", "regression checks"],
      containsPersonalData: false,
      trainingRole: "not_used_for_training",
      notes: "Used to verify behavior in tests. It is not a training dataset."
    }
  ];
}

function buildQualityChecks(profile: IntelligenceDatasetProfile): IntelligenceQualityCheck[] {
  const sourceStatus: IntelligenceQualityStatus = profile.isDemoFallback ? "fail" : "pass";
  const linkedRate = profile.orderHistory.linkedOrderItemRate ?? 0;
  const completionRate = profile.orderHistory.orders ? (profile.orderHistory.completedOrders / profile.orderHistory.orders) * 100 : 0;
  const freshnessDays = profile.orderHistory.latestOrderAgeDays;
  const freshnessStatus: IntelligenceQualityStatus = freshnessDays === null ? "fail" : freshnessDays <= 7 ? "pass" : freshnessDays <= 14 ? "warning" : "fail";
  const marketingConsentRate = profile.customers.total ? (profile.customers.marketingOptIn / profile.customers.total) * 100 : 0;

  return [
    {
      id: "live_data_source",
      label: "Live data source",
      status: sourceStatus,
      value: profile.isDemoFallback ? "Demo fallback" : "Database",
      recommendation: profile.isDemoFallback
        ? "Create real orders, customers, and payments before trusting recommendations."
        : "Runtime recommendations are based on first-party database rows."
    },
    {
      id: "order_history_volume",
      label: "Order history volume",
      status: qualityStatus(profile.orderHistory.orders, 30, 10),
      value: `${profile.orderHistory.orders} orders`,
      recommendation: "Aim for at least 30 recent orders before treating demand patterns as stable."
    },
    {
      id: "history_span",
      label: "History span",
      status: qualityStatus(profile.orderHistory.historyDays, 30, 14),
      value: `${profile.orderHistory.historyDays} days`,
      recommendation: "Keep at least 30 days of order history for weekday and time-slot learning."
    },
    {
      id: "menu_item_mapping",
      label: "Menu item mapping",
      status: qualityStatus(linkedRate, 80, 50),
      value: profile.orderHistory.linkedOrderItemRate === null ? "No order items" : `${profile.orderHistory.linkedOrderItemRate}% linked`,
      recommendation: "Keep order items linked to MenuItem rows instead of relying only on free-text item names."
    },
    {
      id: "recent_activity",
      label: "Recent activity",
      status: freshnessStatus,
      value: freshnessDays === null ? "No orders" : `${freshnessDays} days since latest order`,
      recommendation: "Forecasts are more reliable when recent orders are captured within the last week."
    },
    {
      id: "customer_depth",
      label: "Customer depth",
      status: qualityStatus(profile.customers.total, 20, 5),
      value: `${profile.customers.total} customers`,
      recommendation: "Retention scoring improves once the business has at least 20 customer records."
    },
    {
      id: "payment_depth",
      label: "Payment depth",
      status: qualityStatus(profile.payments.total, 20, 5),
      value: `${profile.payments.total} payments`,
      recommendation: "Payment delay scoring improves once completed and pending payments have enough history."
    },
    {
      id: "order_completion_cleanliness",
      label: "Order completion cleanliness",
      status: profile.orderHistory.orders ? qualityStatus(completionRate, 60, 40) : "fail",
      value: `${round(completionRate, 2)}% completed`,
      recommendation: "Keep cancelled and delivered states accurate. Forecast learning ignores cancelled demand."
    },
    {
      id: "consent_capture",
      label: "Marketing consent capture",
      status: profile.customers.total === 0 ? "fail" : marketingConsentRate > 0 ? "pass" : "warning",
      value: `${profile.customers.marketingOptIn} marketing opt-ins`,
      recommendation: "Campaign recommendations can only target customers with valid marketing consent."
    }
  ];
}

function gateScore(checks: Array<boolean>) {
  if (!checks.length) return 0;
  return round((checks.filter(Boolean).length / checks.length) * 100);
}

function buildReadinessGates(profile: IntelligenceDatasetProfile): IntelligenceReadinessGate[] {
  const blockedByDemo = profile.isDemoFallback;
  const linkedRate = profile.orderHistory.linkedOrderItemRate ?? 0;

  const recommendationChecks = [
    !blockedByDemo,
    profile.orderHistory.orders > 0 || profile.customers.total > 0 || profile.payments.total > 0
  ];
  const demandChecks = [
    !blockedByDemo,
    profile.orderHistory.orders >= 30,
    profile.orderHistory.orderItems >= 30,
    profile.orderHistory.uniqueOrderDates >= 14,
    profile.orderHistory.historyDays >= 21,
    linkedRate >= 70
  ];
  const retentionChecks = [
    !blockedByDemo,
    profile.customers.total >= 20,
    profile.customers.repeatCustomers >= 5,
    profile.orderHistory.orders >= 30
  ];
  const paymentChecks = [
    !blockedByDemo,
    profile.payments.total >= 20,
    profile.payments.completed >= 10,
    profile.payments.pending + profile.payments.failed > 0
  ];
  const mlChecks = [
    !blockedByDemo,
    profile.orderHistory.orders >= 500,
    profile.orderHistory.uniqueOrderDates >= 60,
    profile.customers.total >= 100,
    profile.orderHistory.orderItems >= 1000,
    linkedRate >= 80
  ];

  return [
    {
      id: "owner_recommendations",
      label: "Owner recommendation engine",
      status: readinessStatus(blockedByDemo, recommendationChecks.every(Boolean)),
      score: gateScore(recommendationChecks),
      minimumDataNeeded: "At least one real order, customer, or payment row.",
      reason: blockedByDemo
        ? "The engine is showing demo fallback data because no real activity was loaded."
        : "Rule-based recommendations can run from current first-party activity."
    },
    {
      id: "demand_forecasting",
      label: "Product and time-slot demand forecasting",
      status: readinessStatus(blockedByDemo, demandChecks.every(Boolean)),
      score: gateScore(demandChecks),
      minimumDataNeeded: "30 orders, 30 linked order items, 14 active order dates, and 21 days of history.",
      reason: demandChecks.every(Boolean)
        ? "There is enough linked order history for directional demand forecasts."
        : "Collect more linked orders across more days before trusting product-level forecasts."
    },
    {
      id: "retention_scoring",
      label: "Customer retention and repeat-order scoring",
      status: readinessStatus(blockedByDemo, retentionChecks.every(Boolean)),
      score: gateScore(retentionChecks),
      minimumDataNeeded: "20 customers, 5 repeat customers, and 30 orders.",
      reason: retentionChecks.every(Boolean)
        ? "Customer and repeat-order depth is enough for retention scoring."
        : "Retention alerts are directional until more repeat behavior is captured."
    },
    {
      id: "payment_risk",
      label: "Payment delay and collection priority scoring",
      status: readinessStatus(blockedByDemo, paymentChecks.every(Boolean)),
      score: gateScore(paymentChecks),
      minimumDataNeeded: "20 payments, at least 10 completed payments, and some pending or failed payment examples.",
      reason: paymentChecks.every(Boolean)
        ? "Payment history is deep enough to prioritize collection follow-ups."
        : "Payment risk remains rule-based until more completed and delayed payment examples exist."
    },
    {
      id: "custom_ml_training",
      label: "Custom ML model training readiness",
      status: readinessStatus(blockedByDemo, mlChecks.every(Boolean)),
      score: gateScore(mlChecks),
      minimumDataNeeded: "500 orders, 1,000 order items, 60 active order dates, 100 customers, and 80% item-link quality.",
      reason: mlChecks.every(Boolean)
        ? "The business has enough history to start a supervised model experiment."
        : "Do not train a custom model yet. Keep using explainable rules and collect more clean history."
    }
  ];
}

function overallStatus(gates: IntelligenceReadinessGate[]): IntelligenceReadinessStatus {
  if (gates.some((gate) => gate.status === "blocked")) return "blocked";
  if (gates.every((gate) => gate.status === "ready")) return "ready";
  return "needs_data";
}

function recommendedActions(profile: IntelligenceDatasetProfile, checks: IntelligenceQualityCheck[]) {
  const actions = checks
    .filter((check) => check.status !== "pass")
    .slice(0, 5)
    .map((check) => check.recommendation);

  if (profile.isDemoFallback) {
    actions.unshift("Capture real customer orders and payments; demo fallback data must never be used for accuracy scoring or model training.");
  }

  if (!actions.length) {
    actions.push("Data readiness is healthy. Continue weekly accuracy reviews and monitor drift after operational changes.");
  }

  return Array.from(new Set(actions));
}

function fallbackModelStatuses(): PersistedModelStatus[] {
  return intelligenceModelTypes.map((modelType) => ({
    modelType,
    status: "needs_data",
    rowsAvailable: 0,
    trainingDataStart: null,
    trainingDataEnd: null,
    gates: [],
    missingRequirements: ["No trained first-party model artifact was provided to this governance report."],
    latestVersion: null,
    latestAlgorithm: null,
    lastTrainedAt: null,
    latestTrainingRows: null,
    latestValidationRows: null,
    latestMetrics: null,
    latestRunStatus: null,
    latestRunStartedAt: null,
    latestRunCompletedAt: null,
    latestRunError: null,
    lifecycleStatus: null,
    promotionEligible: false,
    baselineMetrics: null,
    evaluation: null,
    driftStatus: null,
    driftScore: null,
    lastDriftCheckedAt: null
  }));
}

function modelLimitations(status: PersistedModelStatus) {
  const limitations = [
    "Models train only on this business's first-party operational tables.",
    "Customer names, phones, addresses, and notes are not model features."
  ];

  if (status.status !== "trained") {
    limitations.push("Rules/statistical recommendations remain the fallback until a trained artifact exists.");
  }

  if (status.missingRequirements.length) {
    limitations.push(...status.missingRequirements);
  }

  return limitations;
}

function confidenceText(status: PersistedModelStatus) {
  if (status.status !== "trained") return "No ML confidence score is available until this model is trained.";
  if (!status.latestMetrics) return "A trained artifact exists, but validation metrics were not recorded.";
  return "Prediction confidence is generated per prediction from validation quality, model separation, and feature coverage.";
}

function governanceModelStatuses(modelStatuses?: PersistedModelStatus[]) {
  return (modelStatuses?.length ? modelStatuses : fallbackModelStatuses()).map((status) => ({
    modelType: status.modelType,
    status: status.status,
    latestVersion: status.latestVersion,
    trainedAt: status.lastTrainedAt,
    trainingRows: status.latestTrainingRows,
    validationRows: status.latestValidationRows,
    metrics: status.latestMetrics,
    confidence: confidenceText(status),
    missingRequirements: status.missingRequirements,
    limitations: modelLimitations(status)
  }));
}

export function buildBusinessIntelligenceGovernanceReport(
  dataset: BusinessIntelligenceDataset,
  modelStatuses?: PersistedModelStatus[]
): BusinessIntelligenceGovernanceReport {
  const profile = buildDatasetProfile(dataset);
  const dataSources = buildDataSources(dataset, profile);
  const qualityChecks = buildQualityChecks(profile);
  const gates = buildReadinessGates(profile);
  const engine = buildEngineSummary(modelStatuses?.length ? modelStatuses : fallbackModelStatuses());

  return {
    generatedAt: profile.generatedAt,
    business: dataset.business,
    currentEngine: {
      type: engine.type,
      trainedModelInUse: engine.trainedModelInUse,
      dataSource: "first_party_database",
      externalDatasets: "isolated_evaluation_only",
      syntheticProductionData: "none",
      usesExternalDatasets: false,
      summary: engine.trainedModelInUse
        ? "VyapaarMate is using trained first-party ML where a compatible trained artifact exists, with rules/statistical recommendations kept as fallback."
        : "VyapaarMate is using explainable rules and statistical signals because no compatible trained first-party ML artifact is active for this business."
    },
    modelStatus: governanceModelStatuses(modelStatuses),
    datasetProfile: profile,
    dataSources,
    qualityChecks,
    readiness: {
      overallStatus: overallStatus(gates),
      gates
    },
    trainingPlan: {
      currentTrainingStatus: "not_training",
      approvedTrainingSource:
        `Use only training-eligible merchant records with origins ${productionTrainingOrigins.join(", ")} from Business, MenuItem, MenuCategory, Order, OrderItem, Customer, and Payment.`,
      developmentDataset:
        "Unit tests use a synthetic fixture in lib/business-intelligence.test.ts. That fixture is for regression testing only and is not model-training data.",
      externalDatasets: intelligenceBenchmarkDatasets.map((benchmark) => ({
        name: benchmark.name,
        status:
          benchmark.status === "EXCLUDED_DUPLICATE"
            ? "excluded_duplicate"
            : benchmark.status === "INCOMPLETE_CALENDAR_ONLY"
              ? "incomplete"
              : "evaluation_only",
        purpose: `${benchmark.allowedUses.join(", ")}. Never eligible for production training, readiness, health scoring, or owner actions.`
      })),
      futureLabels: [
        {
          label: "Actual product demand by date and time slot",
          builtFrom: "Order.completedAt or scheduledFor (createdAt only as fallback), plus OrderItem.menuItemId, itemName, and quantity",
          useCase: "Demand forecasting"
        },
        {
          label: "Customer returned within the next N days",
          builtFrom: "Tokenized Customer.id and subsequent completed or scheduled Order events",
          useCase: "Repeat-customer and churn prediction"
        },
        {
          label: "Payment resolved successfully or failed",
          builtFrom: "Payment.createdAt, Payment.paidAt, Payment.updatedAt, Payment.status, provider, and amount",
          useCase: "Advisory payment failure and collection risk"
        }
      ],
      privacyControls: [
        "Do not train on customer names, phone numbers, addresses, or free-text notes.",
        "Tokenize customer ids before offline training or export.",
        "Use consent fields only to decide campaign eligibility, not to pressure non-consented customers.",
        "Keep service-role database credentials server-side only and never expose raw data to browser clients."
      ]
    },
    maintenance: {
      ownerReviewCadence: "Review readiness weekly and after menu, pricing, hours, delivery-area, or campaign changes.",
      accuracyEndpoint: "/api/intelligence/accuracy?days=14",
      recommendedActions: recommendedActions(profile, qualityChecks)
    }
  };
}

export async function getBusinessIntelligenceGovernanceReport(businessId: string) {
  const dataset = await getBusinessIntelligenceDataset(businessId);
  const modelStatuses = await getIntelligenceModelStatuses(businessId);
  return buildBusinessIntelligenceGovernanceReport(dataset, modelStatuses);
}
