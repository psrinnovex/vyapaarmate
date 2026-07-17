import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBusinessIntelligenceArtifacts,
  buildBusinessIntelligencePayload,
  calculateDemandForecast,
  calculatePaymentPriority,
  calculateRepeatCustomerScore,
  type BusinessIntelligenceDataset
} from "@/lib/business-intelligence";
import {
  buildCustomersAtRisk,
  buildIntelligenceRecommendations,
  buildIntelligenceSummary,
  buildRevenueOpportunities
} from "@/lib/business-intelligence-api";
import { evaluateBusinessIntelligenceAccuracy } from "@/lib/business-intelligence-accuracy";
import { buildBusinessIntelligenceGovernanceReport } from "@/lib/business-intelligence-governance";
import { buildBusinessIntelligenceMaterializationPlan } from "@/lib/business-intelligence-materialization";

const referenceDate = new Date("2026-07-01T08:00:00+05:30");

function at(value: string) {
  return new Date(value);
}

const liveDataset: BusinessIntelligenceDataset = {
  source: "database",
  business: {
    id: "business_live_1",
    name: "Real Kitchen",
    businessType: "Tiffin Center"
  },
  products: [
    { id: "product_idli", name: "Idli", category: "Breakfast", isAvailable: true },
    { id: "product_dosa", name: "Dosa", category: "Breakfast", isAvailable: true },
    { id: "product_vada", name: "Vada", category: "Breakfast", isAvailable: true },
    { id: "product_combo", name: "Ghee Idli Combo", category: "Breakfast", isAvailable: true }
  ],
  customers: [
    {
      id: "customer_ananya",
      name: "Ananya Rao",
      phone: "+919810000001",
      totalOrders: 6,
      totalSpent: 1320,
      lastOrderAt: at("2026-06-25T08:10:00+05:30"),
      whatsappOptIn: true,
      marketingOptIn: true,
      preferredProducts: ["Idli", "Ghee Idli Combo"]
    },
    {
      id: "customer_ramesh",
      name: "Ramesh Kumar",
      phone: "+919810000002",
      totalOrders: 4,
      totalSpent: 980,
      lastOrderAt: at("2026-06-22T08:20:00+05:30"),
      whatsappOptIn: true,
      marketingOptIn: true,
      preferredProducts: ["Dosa"]
    },
    {
      id: "customer_meena",
      name: "Meena Iyer",
      phone: "+919810000003",
      totalOrders: 1,
      totalSpent: 210,
      lastOrderAt: at("2026-06-30T19:20:00+05:30"),
      whatsappOptIn: true,
      marketingOptIn: false,
      preferredProducts: ["Vada"]
    },
    {
      id: "customer_kiran",
      name: "Kiran Patel",
      phone: "+919810000004",
      totalOrders: 8,
      totalSpent: 2140,
      lastOrderAt: at("2026-06-28T08:00:00+05:30"),
      whatsappOptIn: true,
      marketingOptIn: true,
      preferredProducts: ["Ghee Idli Combo"]
    }
  ],
  orders: [
    {
      id: "order_20260604",
      customerId: "customer_ananya",
      customerName: "Ananya Rao",
      customerPhone: "+919810000001",
      status: "COMPLETED",
      paymentStatus: "PAID",
      totalAmount: 620,
      createdAt: at("2026-06-04T08:10:00+05:30"),
      items: [
        { productId: "product_idli", productName: "Idli", quantity: 20, total: 300 },
        { productId: "product_dosa", productName: "Dosa", quantity: 12, total: 320 }
      ]
    },
    {
      id: "order_20260611",
      customerId: "customer_ramesh",
      customerName: "Ramesh Kumar",
      customerPhone: "+919810000002",
      status: "COMPLETED",
      paymentStatus: "PAID",
      totalAmount: 790,
      createdAt: at("2026-06-11T08:20:00+05:30"),
      items: [
        { productId: "product_idli", productName: "Idli", quantity: 24, total: 360 },
        { productId: "product_dosa", productName: "Dosa", quantity: 14, total: 350 },
        { productId: "product_vada", productName: "Vada", quantity: 8, total: 80 }
      ]
    },
    {
      id: "order_20260618",
      customerId: "customer_kiran",
      customerName: "Kiran Patel",
      customerPhone: "+919810000004",
      status: "COMPLETED",
      paymentStatus: "PAID",
      totalAmount: 940,
      createdAt: at("2026-06-18T08:15:00+05:30"),
      items: [
        { productId: "product_idli", productName: "Idli", quantity: 28, total: 420 },
        { productId: "product_dosa", productName: "Dosa", quantity: 17, total: 425 },
        { productId: "product_vada", productName: "Vada", quantity: 9, total: 95 }
      ]
    },
    {
      id: "order_20260625",
      customerId: "customer_ananya",
      customerName: "Ananya Rao",
      customerPhone: "+919810000001",
      status: "COMPLETED",
      paymentStatus: "PAID",
      totalAmount: 1140,
      createdAt: at("2026-06-25T08:10:00+05:30"),
      items: [
        { productId: "product_idli", productName: "Idli", quantity: 32, total: 480 },
        { productId: "product_dosa", productName: "Dosa", quantity: 20, total: 500 },
        { productId: "product_vada", productName: "Vada", quantity: 16, total: 160 }
      ]
    },
    {
      id: "order_20260628",
      customerId: "customer_kiran",
      customerName: "Kiran Patel",
      customerPhone: "+919810000004",
      status: "COMPLETED",
      paymentStatus: "PAID",
      totalAmount: 520,
      createdAt: at("2026-06-28T19:00:00+05:30"),
      items: [{ productId: "product_combo", productName: "Ghee Idli Combo", quantity: 8, total: 520 }]
    },
    {
      id: "order_20260630",
      customerId: "customer_meena",
      customerName: "Meena Iyer",
      customerPhone: "+919810000003",
      status: "COMPLETED",
      paymentStatus: "PENDING",
      totalAmount: 210,
      createdAt: at("2026-06-30T19:20:00+05:30"),
      items: [{ productId: "product_vada", productName: "Vada", quantity: 7, total: 210 }]
    }
  ],
  payments: [
    {
      id: "payment_current_week",
      orderId: "order_20260628",
      customerId: "customer_kiran",
      customerName: "Kiran Patel",
      customerPhone: "+919810000004",
      amount: 520,
      status: "COMPLETED",
      provider: "CASHFREE",
      createdAt: at("2026-06-28T19:05:00+05:30"),
      paidAt: at("2026-06-28T19:06:00+05:30"),
      customerTotalOrders: 8,
      customerTotalSpent: 2140
    },
    {
      id: "payment_previous_week",
      orderId: "order_20260625",
      customerId: "customer_ananya",
      customerName: "Ananya Rao",
      customerPhone: "+919810000001",
      amount: 1140,
      status: "COMPLETED",
      provider: "CASHFREE",
      createdAt: at("2026-06-25T08:15:00+05:30"),
      paidAt: at("2026-06-25T08:16:00+05:30"),
      customerTotalOrders: 6,
      customerTotalSpent: 1320
    },
    {
      id: "payment_pending_meena",
      orderId: "order_20260630",
      customerId: "customer_meena",
      customerName: "Meena Iyer",
      customerPhone: "+919810000003",
      amount: 210,
      status: "PENDING",
      provider: "UPI",
      createdAt: at("2026-06-30T19:20:00+05:30"),
      paidAt: null,
      customerTotalOrders: 1,
      customerTotalSpent: 210
    },
    {
      id: "payment_pending_ananya",
      orderId: "order_20260629",
      customerId: "customer_ananya",
      customerName: "Ananya Rao",
      customerPhone: "+919810000001",
      amount: 680,
      status: "PENDING",
      provider: "UPI",
      createdAt: at("2026-06-29T08:00:00+05:30"),
      paidAt: null,
      customerTotalOrders: 6,
      customerTotalSpent: 1320
    }
  ],
  now: referenceDate
};

test("calculateDemandForecast returns product forecasts with confidence from live-shaped data", () => {
  const forecasts = calculateDemandForecast({
    orders: liveDataset.orders,
    products: liveDataset.products,
    date: new Date("2026-07-02T08:00:00+05:30"),
    timeSlot: "morning"
  });

  assert.ok(forecasts.length >= 3);
  assert.equal(forecasts[0]?.productName, "Idli");
  assert.ok((forecasts[0]?.predictedQuantity ?? 0) > 0);
  assert.match(forecasts[0]?.reason ?? "", /Thursdays/);
});

test("calculateRepeatCustomerScore identifies reminder opportunities from customer rows", () => {
  const scores = calculateRepeatCustomerScore({
    customers: liveDataset.customers,
    orders: liveDataset.orders,
    now: referenceDate
  });

  assert.ok(scores.length > 0);
  assert.ok(scores.some((score) => score.segment === "Reminder opportunity"));
  assert.ok(scores.every((score) => score.score >= 0 && score.score <= 100));
});

test("calculatePaymentPriority sorts pending payments by live priority inputs", () => {
  const priorities = calculatePaymentPriority({
    payments: liveDataset.payments,
    now: referenceDate
  });

  assert.equal(priorities.length, 2);
  assert.ok(priorities[0]?.priority >= priorities[1]!.priority);
  assert.ok(priorities[0]?.daysOverdue);
});

test("buildBusinessIntelligencePayload returns database-only owner suggestions", () => {
  const payload = buildBusinessIntelligencePayload(liveDataset);

  assert.equal(payload.source, "database");
  assert.equal(payload.business.name, "Real Kitchen");
  assert.ok(payload.businessHealthScore.score >= 0 && payload.businessHealthScore.score <= 100);
  assert.ok(payload.customerRetentionAlerts.count >= 0);
  assert.ok(payload.repeatCustomerOpportunities.count >= 1);
  assert.ok(payload.nextBestActions.length >= 3);
});

test("buildBusinessIntelligenceArtifacts keeps internal customer scores out of the public payload path", () => {
  const artifacts = buildBusinessIntelligenceArtifacts(liveDataset);

  assert.equal(artifacts.payload.business.id, liveDataset.business.id);
  assert.equal(artifacts.customerScores.length, liveDataset.customers.length);
  assert.ok(artifacts.customerScores.some((customer) => customer.segment === "Reminder opportunity"));
});

test("intelligence API summary exposes compact operating signals", () => {
  const payload = buildBusinessIntelligencePayload(liveDataset);
  const summary = buildIntelligenceSummary(payload);

  assert.equal(summary.business.id, liveDataset.business.id);
  assert.equal(summary.operatingSignals.repeatCustomerOpportunityCount, payload.repeatCustomerOpportunities.count);
  assert.equal(summary.operatingSignals.customerRetentionAlertCount, payload.customerRetentionAlerts.count);
  assert.ok(summary.healthScore.score >= 0 && summary.healthScore.score <= 100);
});

test("intelligence API recommendations groups actions by owner workflow", () => {
  const payload = buildBusinessIntelligencePayload(liveDataset);
  const recommendations = buildIntelligenceRecommendations(payload);

  assert.ok(recommendations.actionQueue.length > 0);
  assert.ok(recommendations.demandPreparation.length > 0);
  assert.ok(recommendations.paymentFollowUps.length > 0);
  assert.ok(recommendations.campaignRecommendations.length > 0);
});

test("intelligence API retention and revenue endpoints return actionable slices", () => {
  const payload = buildBusinessIntelligencePayload(liveDataset);
  const customersAtRisk = buildCustomersAtRisk(payload);
  const revenueOpportunities = buildRevenueOpportunities(payload);

  assert.equal(customersAtRisk.count, payload.customerRetentionAlerts.count);
  assert.ok(customersAtRisk.customers.every((customer) => ["High", "Medium", "Low"].includes(customer.riskLevel)));
  assert.ok(revenueOpportunities.opportunitySignals.pendingCollectionAmount > 0);
  assert.ok(revenueOpportunities.opportunities.length > 0);
});

test("business intelligence materialization plan maps payload outputs to persisted rows", () => {
  const artifacts = buildBusinessIntelligenceArtifacts(liveDataset);
  const plan = buildBusinessIntelligenceMaterializationPlan({
    businessId: liveDataset.business.id,
    artifacts
  });

  assert.ok(plan.aiInsights.length >= artifacts.payload.nextBestActions.length);
  assert.equal(plan.healthSnapshot.score, artifacts.payload.businessHealthScore.score);
  assert.equal(plan.customerScores.length, liveDataset.customers.length);
  assert.equal(plan.demandForecasts.length, artifacts.payload.tomorrowDemandForecast.length);
  assert.equal(plan.paymentPriorities.length, artifacts.payload.paymentPriorities.length);
});

test("business intelligence accuracy report backtests forecast output against historical orders", () => {
  const report = evaluateBusinessIntelligenceAccuracy({
    dataset: liveDataset,
    backtestDays: 7,
    includeSamples: true
  });

  assert.equal(report.business.id, liveDataset.business.id);
  assert.equal(report.demandForecastAccuracy.summary.backtestDays, 7);
  assert.ok(report.demandForecastAccuracy.summary.evaluatedSamples > 0);
  assert.ok(report.demandForecastAccuracy.summary.meanAbsoluteError >= 0);
  assert.ok(report.demandForecastAccuracy.byConfidence.length > 0);
  assert.ok(report.maintenance.recommendations.length > 0);
});

test("business intelligence governance report documents data sources and model readiness", () => {
  const report = buildBusinessIntelligenceGovernanceReport(liveDataset);

  assert.equal(report.currentEngine.type, "rules_engine");
  assert.equal(report.currentEngine.trainedModelInUse, false);
  assert.equal(report.currentEngine.usesExternalDatasets, false);
  assert.equal(report.currentEngine.externalDatasets, "isolated_evaluation_only");
  assert.equal(report.currentEngine.syntheticProductionData, "none");
  assert.equal(report.datasetProfile.source, "database");
  assert.equal(report.datasetProfile.orderHistory.linkedOrderItemRate, 100);
  assert.ok(report.dataSources.some((source) => source.storage === "Order, OrderItem" && source.trainingRole === "future_training_label"));
  assert.ok(report.dataSources.some((source) => source.storage === "Customer" && source.containsPersonalData));
  assert.equal(report.readiness.gates.find((gate) => gate.id === "owner_recommendations")?.status, "ready");
  assert.equal(report.readiness.gates.find((gate) => gate.id === "custom_ml_training")?.status, "needs_data");
  assert.ok(report.modelStatus.every((model) => model.status === "needs_data"));
  assert.equal(report.trainingPlan.currentTrainingStatus, "not_training");
  assert.equal(report.trainingPlan.externalDatasets.length, 4);
  assert.ok(report.trainingPlan.externalDatasets.some((dataset) => dataset.status === "excluded_duplicate"));
  assert.ok(report.maintenance.recommendedActions.length > 0);
});
