import assert from "node:assert/strict";
import test from "node:test";
import { businessServiceTypeOptions } from "@/lib/business-service-types";
import { buildBusinessIntelligencePayload, type BusinessIntelligenceDataset } from "@/lib/business-intelligence";
import { buildBusinessIntelligenceGovernanceReport } from "@/lib/business-intelligence-governance";
import { intelligenceBenchmarkDatasets } from "@/lib/intelligence/benchmark-datasets";
import { canManageIntelligenceModels } from "@/lib/intelligence/ml/access";
import { supportedIntelligenceBusinessProfiles } from "@/lib/intelligence/ml/business-profiles";
import { demandTrainingExamples, predictDemandForecasts, trainDemandForecastModel } from "@/lib/intelligence/ml/demand-forecast-model";
import { assessModelDrift } from "@/lib/intelligence/ml/drift";
import {
  buildDemandTrainingExamples,
  buildPaymentRiskTrainingExamples,
  buildRetentionTrainingExamples,
  evaluateModelReadiness,
  type FirstPartyTrainingData
} from "@/lib/intelligence/ml/features";
import {
  intelligenceFeatureSchemaVersions,
  intelligenceModelTypes,
  isCompatibleModelArtifact,
  type FeatureExample,
  type PersistedModelStatus
} from "@/lib/intelligence/ml/model-registry";
import { chronologicalEvaluationSplit } from "@/lib/intelligence/ml/metrics";
import { trainPaymentRiskModel, predictPaymentRisk } from "@/lib/intelligence/ml/payment-risk-model";
import { buildFallbackPredictionResponse } from "@/lib/intelligence/ml/prediction-service";
import { predictRetention, trainRetentionModel } from "@/lib/intelligence/ml/retention-model";

const baseDate = new Date("2026-01-01T08:00:00+05:30");
const now = new Date("2026-05-20T08:00:00+05:30");

function addDays(date: Date, days: number, hour = 8) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  copy.setHours(hour, 0, 0, 0);
  return copy;
}

function syntheticTrainingData(): FirstPartyTrainingData {
  const menuItems = [
    { id: "item_idli", name: "Idli", categoryId: "cat_breakfast", categoryName: "Breakfast", isAvailable: true, price: 40 },
    { id: "item_dosa", name: "Dosa", categoryId: "cat_breakfast", categoryName: "Breakfast", isAvailable: true, price: 70 },
    { id: "item_meals", name: "Meals", categoryId: "cat_lunch", categoryName: "Lunch", isAvailable: true, price: 140 }
  ];
  const customers = Array.from({ length: 120 }, (_, index) => ({
    id: `customer_${index}`,
    name: `Customer ${index}`,
    phone: `+91981000${String(index).padStart(4, "0")}`,
    totalOrders: 0,
    totalSpent: 0,
    lastOrderAt: null as Date | null,
    createdAt: addDays(baseDate, -20)
  }));
  const orders: FirstPartyTrainingData["orders"] = [];
  const payments: FirstPartyTrainingData["payments"] = [];

  for (let day = 0; day < 120; day += 1) {
    const ordersPerDay = day % 6 === 0 ? 5 : 3;
    for (let orderIndex = 0; orderIndex < ordersPerDay; orderIndex += 1) {
      const customer = customers[(day * 3 + orderIndex) % customers.length]!;
      const item = menuItems[(day + orderIndex) % menuItems.length]!;
      const quantity = item.id === "item_idli" ? 8 + (day % 5) : item.id === "item_dosa" ? 4 + (day % 4) : 2 + (day % 3);
      const createdAt = addDays(baseDate, day, item.id === "item_meals" ? 13 : 8);
      const orderId = `order_${day}_${orderIndex}`;
      const totalAmount = quantity * item.price;
      const paymentStatus = day % 17 === 0 ? "FAILED" : day % 11 === 0 ? "PENDING" : "COMPLETED";

      orders.push({
        id: orderId,
        customerId: customer.id,
        status: "DELIVERED",
        paymentStatus,
        totalAmount,
        orderType: "PICKUP",
        createdAt,
        items: [
          {
            id: `order_item_${day}_${orderIndex}`,
            menuItemId: item.id,
            itemName: item.name,
            quantity,
            total: totalAmount,
            categoryId: item.categoryId,
            categoryName: item.categoryName
          }
        ]
      });

      payments.push({
        id: `payment_${day}_${orderIndex}`,
        businessId: "business_ai_test",
        orderId,
        customerId: customer.id,
        amount: totalAmount,
        status: paymentStatus,
        provider: orderIndex % 2 === 0 ? "CASHFREE" : "UPI",
        createdAt,
        paidAt: paymentStatus === "COMPLETED" ? addDays(createdAt, 0, createdAt.getHours() + 1) : null
      });

      customer.totalOrders += 1;
      customer.totalSpent += totalAmount;
      customer.lastOrderAt = createdAt;
    }
  }

  return {
    business: {
      id: "business_ai_test",
      name: "AI Test Kitchen",
      businessType: "Restaurant"
    },
    menuItems,
    customers,
    orders,
    payments,
    now
  };
}

function toRulesDataset(data: FirstPartyTrainingData): BusinessIntelligenceDataset {
  return {
    source: "database",
    business: data.business,
    products: data.menuItems.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.categoryName,
      isAvailable: item.isAvailable
    })),
    customers: data.customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      phone: customer.phone ?? "",
      totalOrders: customer.totalOrders,
      totalSpent: customer.totalSpent,
      lastOrderAt: customer.lastOrderAt,
      whatsappOptIn: true,
      marketingOptIn: true
    })),
    orders: data.orders.map((order) => ({
      id: order.id,
      customerId: order.customerId,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      orderType: order.orderType,
      items: order.items.map((item) => ({
        productId: item.menuItemId,
        productName: item.itemName,
        quantity: item.quantity,
        total: item.total
      }))
    })),
    payments: data.payments.map((payment) => ({
      id: payment.id,
      orderId: payment.orderId,
      customerId: payment.customerId,
      customerName: payment.customerId,
      customerPhone: "",
      amount: payment.amount,
      status: payment.status,
      provider: payment.provider,
      createdAt: payment.createdAt,
      paidAt: payment.paidAt
    })),
    now: data.now
  };
}

function trainedStatuses(): PersistedModelStatus[] {
  return intelligenceModelTypes.map((modelType) => ({
    modelType,
    status: "trained",
    rowsAvailable: 500,
    trainingDataStart: baseDate,
    trainingDataEnd: now,
    gates: [],
    missingRequirements: [],
    latestVersion: `${modelType}_test`,
    latestAlgorithm: "test_algorithm",
    lastTrainedAt: now.toISOString(),
    latestTrainingRows: 400,
    latestValidationRows: 100,
    latestMetrics: modelType === "demand"
      ? { mae: 1, rmse: 1.2, mape: 8, wape: 7, evaluatedRows: 100 }
      : {
          accuracy: 0.8,
          precision: 0.75,
          recall: 0.7,
          f1: 0.72,
          auc: 0.81,
          prAuc: 0.76,
          brierScore: 0.16,
          expectedCalibrationError: 0.08,
          threshold: 0.5,
          evaluatedRows: 100,
          positiveRows: 40,
          negativeRows: 60
        },
    latestRunStatus: "trained",
    latestRunStartedAt: baseDate.toISOString(),
    latestRunCompletedAt: now.toISOString(),
    latestRunError: null,
    lifecycleStatus: "active",
    promotionEligible: true,
    baselineMetrics: null,
    evaluation: null,
    driftStatus: "stable",
    driftScore: 0.05,
    lastDriftCheckedAt: now.toISOString()
  }));
}

test("feature extraction builds real-like first-party ML feature rows", () => {
  const data = syntheticTrainingData();
  const examples = buildDemandTrainingExamples(data);

  assert.ok(examples.length > 0);
  assert.equal(examples[0]?.entityType, "menu_item");
  assert.equal(typeof examples[0]?.features.dayOfWeek, "number");
  assert.equal(typeof examples[0]?.features.recent14Quantity, "number");
  assert.ok(Object.keys(examples[0]?.features ?? {}).some((feature) => feature.startsWith("item:")));
});

test("minimum data gates return needs_data with exact missing requirements", () => {
  const small = syntheticTrainingData();
  small.orders = small.orders.slice(0, 12);
  small.payments = small.payments.slice(0, 12);
  small.customers = small.customers.slice(0, 8);

  const demand = evaluateModelReadiness(small, "demand");
  const retention = evaluateModelReadiness(small, "retention");
  const payment = evaluateModelReadiness(small, "payment_risk");

  assert.equal(demand.status, "needs_data");
  assert.ok(demand.missingRequirements.some((requirement) => requirement.includes("Completed order history")));
  assert.equal(retention.status, "needs_data");
  assert.equal(payment.status, "needs_data");
});

test("demand and retention readiness require every volume, history, maturity, and quality gate", () => {
  const data = syntheticTrainingData();
  const oneActivityDate = new Date("2026-05-01T10:00:00.000Z");
  data.orders = data.orders.map((order) => ({ ...order, completedAt: oneActivityDate }));

  const demand = evaluateModelReadiness(data, "demand");
  const retention = evaluateModelReadiness(data, "retention");

  assert.equal(demand.gates.find((gate) => gate.id === "completed_linked_orders")?.met, true);
  assert.equal(demand.gates.find((gate) => gate.id === "history_days")?.met, false);
  assert.equal(demand.gates.find((gate) => gate.id === "active_order_days")?.met, false);
  assert.equal(demand.status, "needs_data");
  assert.equal(retention.gates.find((gate) => gate.id === "customers")?.met, true);
  assert.equal(retention.gates.find((gate) => gate.id === "history_days")?.met, false);
  assert.equal(retention.status, "needs_data");
});

test("payment training excludes unresolved/refunded outcomes and does not leak final status features", () => {
  const data = syntheticTrainingData();
  const seed = data.payments[0]!;
  const firstCreatedAt = seed.createdAt;
  data.payments = [
    { ...seed, id: "paid", status: "COMPLETED", createdAt: firstCreatedAt, resolvedAt: firstCreatedAt },
    {
      ...seed,
      id: "failed_future_resolution",
      status: "FAILED",
      createdAt: addDays(firstCreatedAt, 1),
      resolvedAt: addDays(firstCreatedAt, 4)
    },
    {
      ...seed,
      id: "candidate",
      status: "FAILED",
      createdAt: addDays(firstCreatedAt, 2),
      resolvedAt: addDays(firstCreatedAt, 2)
    },
    { ...seed, id: "pending", status: "PENDING", createdAt: addDays(firstCreatedAt, 3) },
    { ...seed, id: "refunded", status: "REFUNDED", createdAt: addDays(firstCreatedAt, 4) }
  ];

  const examples = buildPaymentRiskTrainingExamples(data);
  const featureNames = new Set(examples.flatMap((example) => Object.keys(example.features)));

  assert.deepEqual(examples.map((example) => example.entityId), ["paid", "failed_future_resolution", "candidate"]);
  assert.deepEqual(examples.map((example) => example.label), [0, 1, 1]);
  assert.equal(examples.find((example) => example.entityId === "candidate")?.features.priorFailedCount, 0);
  assert.equal(Array.from(featureNames).some((feature) => /paymentStatus|orderStatus/i.test(feature)), false);
});

test("training creates real model artifacts and trained models return predictions", () => {
  const data = syntheticTrainingData();
  const demandResult = trainDemandForecastModel(demandTrainingExamples(data));

  assert.equal(demandResult.artifact.modelType, "demand");
  assert.equal(demandResult.artifact.featureSchemaVersion, intelligenceFeatureSchemaVersions.demand);
  assert.equal(demandResult.artifact.algorithm, "regularized_linear_regression_sparse_minibatch");
  assert.ok(demandResult.trainRows > 0);
  assert.ok(demandResult.validationRows > 0);
  assert.ok(demandResult.artifact.featureNames.length > 0);

  const predictions = predictDemandForecasts({ artifact: demandResult.artifact, data, modelVersion: "demand_test_v1" });
  assert.ok(predictions.length > 0);
  assert.ok(predictions[0]!.confidence > 0);
  assert.match(predictions[0]!.explanationJson.text, /Demand forecast/);
});

test("artifacts from an obsolete feature schema are rejected", () => {
  const result = trainDemandForecastModel(demandTrainingExamples(syntheticTrainingData()));
  const obsolete = { ...result.artifact, featureSchemaVersion: result.artifact.featureSchemaVersion - 1 };

  assert.equal(isCompatibleModelArtifact(result.artifact, "demand"), true);
  assert.equal(isCompatibleModelArtifact(obsolete, "demand"), false);
  assert.equal(isCompatibleModelArtifact(result.artifact, "payment_risk"), false);
});

test("retention and payment risk train logistic models from first-party-shaped history", () => {
  const data = syntheticTrainingData();
  const retentionExamples = buildRetentionTrainingExamples(data);
  const paymentExamples = buildPaymentRiskTrainingExamples(data);

  const retentionResult = trainRetentionModel(retentionExamples);
  const paymentResult = trainPaymentRiskModel(paymentExamples);

  assert.equal(retentionResult.artifact.algorithm, "calibrated_regularized_logistic_regression_sparse_minibatch");
  assert.equal(paymentResult.artifact.algorithm, "calibrated_regularized_logistic_regression_sparse_minibatch");
  assert.ok(predictRetention({ artifact: retentionResult.artifact, data }).length > 0);
  assert.ok(predictPaymentRisk({ artifact: paymentResult.artifact, data }).length > 0);
});

test("prediction fallback returns rules output when no model exists", () => {
  const data = syntheticTrainingData();
  const rulesPayload = buildBusinessIntelligencePayload(toRulesDataset(data));
  const response = buildFallbackPredictionResponse({
    businessId: data.business.id,
    statuses: [],
    rulesPayload
  });

  assert.equal(response.fallback, true);
  assert.equal(response.engine.type, "rules_engine");
  assert.equal(response.externalDatasets, "isolated_evaluation_only");
  assert.equal(response.syntheticProductionData, "none");
  assert.equal(response.rulesEngine.business.id, data.business.id);
});

test("governance says trained_ml only when trained artifacts are supplied", () => {
  const data = syntheticTrainingData();
  const dataset = toRulesDataset(data);
  const rulesOnly = buildBusinessIntelligenceGovernanceReport(dataset);
  const trained = buildBusinessIntelligenceGovernanceReport(dataset, trainedStatuses());

  assert.equal(rulesOnly.currentEngine.type, "rules_engine");
  assert.equal(rulesOnly.currentEngine.trainedModelInUse, false);
  assert.equal(trained.currentEngine.type, "trained_ml");
  assert.equal(trained.currentEngine.trainedModelInUse, true);
  assert.equal(trained.currentEngine.externalDatasets, "isolated_evaluation_only");
  assert.equal(trained.currentEngine.syntheticProductionData, "none");
  assert.equal(trained.trainingPlan.externalDatasets.length, 4);
  assert.ok(trained.trainingPlan.externalDatasets.every((dataset) => /Never eligible for production/.test(dataset.purpose)));
});

test("every registered external benchmark is ineligible for production training", () => {
  assert.equal(intelligenceBenchmarkDatasets.length, 4);
  assert.ok(intelligenceBenchmarkDatasets.every((dataset) => dataset.productionTrainingEligible === false));
  assert.equal(intelligenceBenchmarkDatasets.find((dataset) => dataset.id === "uci-online-retail")?.status, "EXCLUDED_DUPLICATE");
  assert.equal(intelligenceBenchmarkDatasets.find((dataset) => dataset.id === "m5-calendar-selected-columns")?.status, "INCOMPLETE_CALENDAR_ONLY");
});

test("owner/admin access checks block cross-business model operations", () => {
  assert.equal(canManageIntelligenceModels({ role: "OWNER", businessId: "business_a" }, "business_a"), true);
  assert.equal(canManageIntelligenceModels({ role: "OWNER", businessId: "business_a" }, "business_b"), false);
  assert.equal(canManageIntelligenceModels({ role: "MANAGER", businessId: "business_a" }, "business_a"), false);
  assert.equal(canManageIntelligenceModels({ role: "SUPER_ADMIN", businessId: null }, "business_b"), true);
});

test("all 15 supported business types have an explicit intelligence family and horizon", () => {
  assert.equal(businessServiceTypeOptions.length, 15);
  assert.equal(supportedIntelligenceBusinessProfiles.length, 15);
  assert.deepEqual(
    supportedIntelligenceBusinessProfiles.map((profile) => profile.businessType).sort(),
    businessServiceTypeOptions.map((option) => option.name).sort()
  );
  assert.ok(supportedIntelligenceBusinessProfiles.every((profile) => profile.retentionHorizonDays >= 30));
  assert.deepEqual(
    new Set(supportedIntelligenceBusinessProfiles.map((profile) => profile.family)),
    new Set(["food", "retail", "appointment", "service_job"])
  );
});

test("future validation embargo removes labels that were unavailable at the cutoff", () => {
  const rows = Array.from({ length: 10 }, (_, index) => ({
    observedAt: addDays(baseDate, index),
    labelAvailableAt: addDays(baseDate, index + 4),
    index
  }));
  const split = chronologicalEvaluationSplit(rows, { validationRatio: 0.2, minimumValidationRows: 2 });

  assert.equal(split.validationStart?.getTime(), addDays(baseDate, 8).getTime());
  assert.deepEqual(split.validationRows.map((row) => row.index), [8, 9]);
  assert.deepEqual(split.trainRows.map((row) => row.index), [0, 1, 2, 3, 4]);
  assert.deepEqual(split.embargoRows.map((row) => row.index), [5, 6, 7]);
});

test("classification artifacts carry calibration, baseline evaluation, and promotion evidence", () => {
  const result = trainRetentionModel(buildRetentionTrainingExamples(syntheticTrainingData()));

  assert.equal(result.artifact.calibration?.method, "platt");
  assert.ok((result.artifact.calibration?.fittedRows ?? 0) > 0);
  assert.ok((result.artifact.decisionThreshold ?? 0) >= 0.1);
  assert.ok((result.artifact.decisionThreshold ?? 1) <= 0.9);
  assert.equal(result.evaluation.calibration?.method, "platt");
  assert.equal(typeof result.evaluation.promotion.passed, "boolean");
  assert.equal(result.evaluation.promotion.primaryMetric, "pr_auc_and_brier");
  assert.ok("prAuc" in result.evaluation.baselineMetrics);
});

test("bounded training handles 108,070 chronological rows and critical drift requires two checks", () => {
  const origin = Date.parse("2020-01-01T00:00:00.000Z");
  const rows: FeatureExample[] = Array.from({ length: 108_070 }, (_, index) => {
    const observedAt = new Date(origin + index * 60_000);
    return {
      entityId: `stress_${index}`,
      entityType: "menu_item",
      label: 10 + (index % 7) * 2 + index / 100_000,
      labelAvailableAt: new Date(observedAt.getTime() + 60_000),
      baselinePrediction: 10 + (index % 7) * 2,
      observedAt,
      features: {
        dayOfWeek: index % 7,
        trend: index / 100_000,
        "item:hstress": 1
      },
      metadata: {}
    };
  });
  const trained = trainDemandForecastModel(rows);
  assert.equal(trained.rowsConsidered, 108_070);
  assert.ok(trained.rowsUsed <= 60_000);
  assert.equal(trained.bounded, true);

  const shiftedRows: FeatureExample[] = Array.from({ length: 20 }, (_, index) => ({
    entityId: `shifted_${index}`,
    entityType: "menu_item",
    observedAt: new Date(origin + index * 60_000),
    features: Object.fromEntries(
      trained.artifact.featureNames.map((name, featureIndex) => [
        name,
        (trained.artifact.referenceMeans?.[featureIndex] ?? 0) +
          10 * (trained.artifact.referenceStds?.[featureIndex] ?? 1)
      ])
    ),
    metadata: {}
  }));
  const first = assessModelDrift({ artifact: trained.artifact, examples: shiftedRows });
  const second = assessModelDrift({ artifact: trained.artifact, examples: shiftedRows, previousConsecutiveCritical: 1 });
  assert.equal(first.status, "critical");
  assert.equal(first.shouldRollback, false);
  assert.equal(second.consecutiveCritical, 2);
  assert.equal(second.shouldRollback, true);
});
