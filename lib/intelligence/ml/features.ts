import { stableHash, type FeatureExample, type FeatureMap, type IntelligenceModelType, type ModelReadiness } from "@/lib/intelligence/ml/model-registry";
import { intelligenceBusinessProfile } from "@/lib/intelligence/ml/business-profiles";
import { boundedChronologicalRows } from "@/lib/intelligence/ml/metrics";
import { intelligenceTrainingBounds } from "@/lib/intelligence/ml/training-policy";
import {
  addBusinessDays as addDays,
  businessDateKey as dateKey,
  businessDayOfMonth,
  businessDayOfWeek,
  businessDaysBetween as daysBetween,
  businessMonth,
  startOfBusinessDay as startOfDay
} from "@/lib/intelligence/intelligence-time";

export type FirstPartyMenuItemRecord = {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  isAvailable: boolean;
  price: number;
};

export type FirstPartyOrderItemRecord = {
  id: string;
  menuItemId: string | null;
  itemName: string;
  quantity: number;
  total: number;
  categoryId?: string | null;
  categoryName?: string | null;
};

export type FirstPartyOrderRecord = {
  id: string;
  customerId: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  orderType: string;
  createdAt: Date;
  scheduledFor?: Date | null;
  completedAt?: Date | null;
  items: FirstPartyOrderItemRecord[];
};

export type FirstPartyCustomerRecord = {
  id: string;
  name: string;
  phone?: string | null;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: Date | null;
  createdAt: Date;
};

export type FirstPartyPaymentRecord = {
  id: string;
  businessId: string;
  orderId: string;
  customerId: string;
  amount: number;
  status: string;
  provider: string;
  createdAt: Date;
  paidAt: Date | null;
  resolvedAt?: Date | null;
};

export type FirstPartyTrainingData = {
  business: {
    id: string;
    name: string;
    businessType: string;
  };
  menuItems: FirstPartyMenuItemRecord[];
  orders: FirstPartyOrderRecord[];
  customers: FirstPartyCustomerRecord[];
  payments: FirstPartyPaymentRecord[];
  now: Date;
};

export type FirstPartyDataProfile = {
  completedLinkedOrders: number;
  completedLinkedOrderItems: number;
  completedOrderHistoryDays: number;
  completedOrderActiveDays: number;
  linkedItemRate: number;
  customerCount: number;
  customerLinkedOrders: number;
  repeatCustomerCount: number;
  paymentCount: number;
  resolvedPayments: number;
  completedPayments: number;
  failedPayments: number;
  dataStart: Date | null;
  dataEnd: Date | null;
};

function dateRange(start: Date, end: Date) {
  const dates: Date[] = [];
  for (let cursor = startOfDay(start); cursor <= startOfDay(end); cursor = addDays(cursor, 1)) {
    dates.push(cursor);
  }
  return dates;
}

function isCompletedOrder(order: Pick<FirstPartyOrderRecord, "status">) {
  return order.status === "DELIVERED" || order.status === "COMPLETED";
}

function isCancelledOrder(order: Pick<FirstPartyOrderRecord, "status">) {
  return order.status === "CANCELLED";
}

function isSuccessfulPayment(payment: Pick<FirstPartyPaymentRecord, "status"> | { status: string }) {
  return payment.status === "COMPLETED" || payment.status === "PAID";
}

function isResolvedPayment(payment: Pick<FirstPartyPaymentRecord, "status"> | { status: string }) {
  return isSuccessfulPayment(payment) || payment.status === "FAILED";
}

function isFailedPayment(payment: Pick<FirstPartyPaymentRecord, "status"> | { status: string }) {
  return payment.status === "FAILED";
}

function paymentOutcomeAvailableAt(payment: FirstPartyPaymentRecord) {
  if (isSuccessfulPayment(payment)) return payment.paidAt ?? payment.resolvedAt ?? payment.createdAt;
  return payment.resolvedAt ?? payment.createdAt;
}

function isSuccessfulPaymentBy(payment: FirstPartyPaymentRecord, cutoff: Date) {
  return isSuccessfulPayment(payment) && paymentOutcomeAvailableAt(payment).getTime() <= cutoff.getTime();
}

function safeNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function logFeature(value: number) {
  return Math.log1p(Math.max(0, safeNumber(value)));
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function normalizedTrend(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 1 : 0;
  return Math.max(-1, Math.min(1, (current - previous) / previous));
}

function categoricalFeature(prefix: string, value: string | null | undefined) {
  return `${prefix}:${stableHash(value)}`;
}

function entityKeyForItem(item: Pick<FirstPartyOrderItemRecord, "menuItemId" | "itemName">) {
  return stableHash(item.menuItemId ?? item.itemName);
}

function orderActivityAt(order: FirstPartyOrderRecord) {
  return order.completedAt ?? order.scheduledFor ?? order.createdAt;
}

function orderTimes(orders: FirstPartyOrderRecord[]) {
  return orders.map((order) => orderActivityAt(order).getTime()).filter(Number.isFinite);
}

export function buildFirstPartyDataProfile(data: FirstPartyTrainingData): FirstPartyDataProfile {
  const completedLinkedOrders = data.orders.filter((order) => isCompletedOrder(order) && order.items.some((item) => item.menuItemId)).length;
  const completedLinkedOrderItems = data.orders
    .filter(isCompletedOrder)
    .reduce((count, order) => count + order.items.filter((item) => item.menuItemId).length, 0);
  const completedLinkedOrderDates = data.orders
    .filter((order) => isCompletedOrder(order) && order.items.some((item) => item.menuItemId))
    .map((order) => startOfDay(orderActivityAt(order)).getTime());
  const activeDates = new Set(completedLinkedOrderDates.map((time) => new Date(time).toISOString().slice(0, 10)));
  const completedItems = data.orders.filter(isCompletedOrder).flatMap((order) => order.items);
  const customerOrderCounts = new Map<string, number>();
  data.orders.filter((order) => !isCancelledOrder(order)).forEach((order) => {
    customerOrderCounts.set(order.customerId, (customerOrderCounts.get(order.customerId) ?? 0) + 1);
  });
  const resolvedPayments = data.payments.filter(isResolvedPayment);
  const earliestLinkedOrder = completedLinkedOrderDates.length ? new Date(Math.min(...completedLinkedOrderDates)) : null;
  const latestLinkedOrder = completedLinkedOrderDates.length ? new Date(Math.max(...completedLinkedOrderDates)) : null;
  const allTimes = [
    ...orderTimes(data.orders),
    ...data.payments.map((payment) => payment.createdAt.getTime()).filter(Number.isFinite),
    ...data.customers.map((customer) => customer.createdAt.getTime()).filter(Number.isFinite)
  ];

  return {
    completedLinkedOrders,
    completedLinkedOrderItems,
    completedOrderHistoryDays: earliestLinkedOrder && latestLinkedOrder ? daysBetween(earliestLinkedOrder, latestLinkedOrder) + 1 : 0,
    completedOrderActiveDays: activeDates.size,
    linkedItemRate: completedItems.length ? completedItems.filter((item) => item.menuItemId).length / completedItems.length : 0,
    customerCount: data.customers.length,
    customerLinkedOrders: data.orders.filter((order) => Boolean(order.customerId) && !isCancelledOrder(order)).length,
    repeatCustomerCount: Array.from(customerOrderCounts.values()).filter((count) => count >= 2).length,
    paymentCount: data.payments.length,
    resolvedPayments: resolvedPayments.length,
    completedPayments: resolvedPayments.filter(isSuccessfulPayment).length,
    failedPayments: resolvedPayments.filter(isFailedPayment).length,
    dataStart: allTimes.length ? new Date(Math.min(...allTimes)) : null,
    dataEnd: allTimes.length ? new Date(Math.max(...allTimes)) : null
  };
}

function readinessGate(id: string, label: string, actual: number, required: number, unit: string, met = actual >= required) {
  return {
    id,
    label,
    actual,
    required,
    unit,
    met,
    missing: Math.max(0, required - actual)
  };
}

export function evaluateModelReadiness(data: FirstPartyTrainingData, modelType: IntelligenceModelType): ModelReadiness {
  const profile = buildFirstPartyDataProfile(data);

  if (modelType === "demand") {
    const historyGate = readinessGate("history_days", "Completed order history", profile.completedOrderHistoryDays, 90, "days");
    const completedOrdersGate = readinessGate("completed_linked_orders", "Completed orders with linked items", profile.completedLinkedOrders, 300, "orders");
    const activeDaysGate = readinessGate("active_order_days", "Active completed-order days", profile.completedOrderActiveDays, 30, "days");
    const linkQualityGate = readinessGate("linked_item_rate", "Completed item link quality", Math.round(profile.linkedItemRate * 100), 80, "percent");
    const gates = [historyGate, completedOrdersGate, activeDaysGate, linkQualityGate];
    const ready = gates.every((gate) => gate.met);

    return {
      modelType,
      status: ready ? "ready_for_training" : "needs_data",
      rowsAvailable: profile.completedLinkedOrderItems,
      trainingDataStart: profile.dataStart,
      trainingDataEnd: profile.dataEnd,
      gates,
      missingRequirements: ready
        ? []
        : gates.filter((gate) => !gate.met).map((gate) => `${gate.label} needs ${gate.missing} more ${gate.unit}.`)
    };
  }

  if (modelType === "retention") {
    const businessProfile = intelligenceBusinessProfile(data.business.businessType);
    const customerGate = readinessGate("customers", "Customers", profile.customerCount, 100, "customers");
    const orderGate = readinessGate("customer_linked_orders", "Customer-linked orders", profile.customerLinkedOrders, 300, "orders");
    const repeatGate = readinessGate("repeat_customers", "Repeat customers", profile.repeatCustomerCount, 20, "customers");
    const requiredHistoryDays = Math.max(90, 30 + Math.ceil(businessProfile.retentionHorizonDays * 2.5));
    const historyGate = readinessGate("history_days", "Customer order history", profile.completedOrderHistoryDays, requiredHistoryDays, "days");
    const gates = [customerGate, orderGate, repeatGate, historyGate];
    const ready = gates.every((gate) => gate.met);

    return {
      modelType,
      status: ready ? "ready_for_training" : "needs_data",
      rowsAvailable: Math.max(profile.customerCount, profile.customerLinkedOrders),
      trainingDataStart: profile.dataStart,
      trainingDataEnd: profile.dataEnd,
      gates,
      missingRequirements: ready
        ? []
        : gates.filter((gate) => !gate.met).map((gate) => `${gate.label} needs ${gate.missing} more ${gate.unit}.`)
    };
  }

  const totalGate = readinessGate("resolved_payments", "Resolved payment examples", profile.resolvedPayments, 300, "payments");
  const successGate = readinessGate("successful_payments", "Successful payment examples", profile.completedPayments, 50, "payments");
  const riskGate = readinessGate("failed_payments", "Resolved failed payment examples", profile.failedPayments, 30, "payments");
  const ready = totalGate.met && successGate.met && riskGate.met;

  return {
    modelType,
    status: ready ? "ready_for_training" : "needs_data",
    rowsAvailable: profile.resolvedPayments,
    trainingDataStart: profile.dataStart,
    trainingDataEnd: profile.dataEnd,
    gates: [totalGate, successGate, riskGate],
    missingRequirements: ready
      ? []
      : [
          `Payment risk needs ${totalGate.missing} more resolved payments, ${successGate.missing} more successful payments, and ${riskGate.missing} more resolved failed payments.`
        ]
  };
}

type DemandEntity = {
  key: string;
  entityId: string;
  itemName: string;
  categoryKey: string;
  categoryName: string | null;
  isAvailable: boolean;
};

function demandEntities(data: FirstPartyTrainingData) {
  const entities = new Map<string, DemandEntity>();

  data.menuItems.forEach((item) => {
    const key = stableHash(item.id);
    entities.set(key, {
      key,
      entityId: item.id,
      itemName: item.name,
      categoryKey: stableHash(item.categoryId ?? item.categoryName ?? "uncategorized"),
      categoryName: item.categoryName,
      isAvailable: item.isAvailable
    });
  });

  data.orders.forEach((order) => {
    order.items.forEach((item) => {
      const key = entityKeyForItem(item);
      if (entities.has(key)) return;
      entities.set(key, {
        key,
        entityId: item.menuItemId ?? key,
        itemName: item.itemName,
        categoryKey: stableHash(item.categoryId ?? item.categoryName ?? "uncategorized"),
        categoryName: item.categoryName ?? null,
        isAvailable: true
      });
    });
  });

  return Array.from(entities.values());
}

function demandQuantityIndex(orders: FirstPartyOrderRecord[]) {
  const index = new Map<string, Map<string, number>>();

  orders.filter(isCompletedOrder).forEach((order) => {
    const key = dateKey(orderActivityAt(order));
    const byItem = index.get(key) ?? new Map<string, number>();
    order.items.forEach((item) => {
      const itemKey = entityKeyForItem(item);
      byItem.set(itemKey, (byItem.get(itemKey) ?? 0) + item.quantity);
    });
    index.set(key, byItem);
  });

  return index;
}

function ordersBetween(orders: FirstPartyOrderRecord[], start: Date, end: Date) {
  return orders.filter((order) => {
    const activityAt = orderActivityAt(order);
    return !isCancelledOrder(order) && activityAt >= start && activityAt < end;
  });
}

function paymentsBetween(payments: FirstPartyPaymentRecord[], start: Date, end: Date) {
  return payments.filter((payment) => payment.createdAt >= start && payment.createdAt < end);
}

function sumRecentQuantity(quantityByDate: Map<string, Map<string, number>>, entityKey: string, targetDate: Date, days: number) {
  const start = addDays(startOfDay(targetDate), -days);
  let total = 0;
  for (const date of dateRange(start, addDays(startOfDay(targetDate), -1))) {
    total += quantityByDate.get(dateKey(date))?.get(entityKey) ?? 0;
  }
  return total;
}

function demandFeatures({
  data,
  quantityByDate,
  entity,
  targetDate
}: {
  data: FirstPartyTrainingData;
  quantityByDate: Map<string, Map<string, number>>;
  entity: DemandEntity;
  targetDate: Date;
}): FeatureMap {
  const day = startOfDay(targetDate);
  const prior7Start = addDays(day, -7);
  const prior14Start = addDays(day, -14);
  const prior30Start = addDays(day, -30);
  const prior7Orders = ordersBetween(data.orders, prior7Start, day);
  const previous7Orders = ordersBetween(data.orders, prior14Start, prior7Start);
  const prior30Orders = ordersBetween(data.orders, prior30Start, day);
  const prior30Payments = paymentsBetween(data.payments, prior30Start, day);
  const averageOrderValue = prior30Orders.length
    ? prior30Orders.reduce((sum, order) => sum + order.totalAmount, 0) / prior30Orders.length
    : 0;
  const paymentSuccessRatio = prior30Payments.length
    ? ratio(prior30Payments.filter((payment) => isSuccessfulPaymentBy(payment, day)).length, prior30Payments.length)
    : 0;

  return {
    dayOfWeek: businessDayOfWeek(day) / 6,
    isWeekend: businessDayOfWeek(day) === 0 || businessDayOfWeek(day) === 6 ? 1 : 0,
    weekOfMonth: Math.ceil(businessDayOfMonth(day) / 7) / 5,
    month: (businessMonth(day) + 1) / 12,
    recent7Quantity: logFeature(sumRecentQuantity(quantityByDate, entity.key, day, 7)),
    recent14Quantity: logFeature(sumRecentQuantity(quantityByDate, entity.key, day, 14)),
    recent30Quantity: logFeature(sumRecentQuantity(quantityByDate, entity.key, day, 30)),
    averageOrderValue: logFeature(averageOrderValue),
    paymentSuccessRatio,
    orderCountTrend: normalizedTrend(prior7Orders.length, previous7Orders.length),
    [categoricalFeature("businessFamily", intelligenceBusinessProfile(data.business.businessType).family)]: 1,
    [categoricalFeature("item", entity.key)]: 1,
    [categoricalFeature("category", entity.categoryKey)]: 1
  };
}

function demandBaselinePrediction(
  quantityByDate: Map<string, Map<string, number>>,
  entityKey: string,
  targetDate: Date
) {
  const sameWeekday = quantityByDate.get(dateKey(addDays(startOfDay(targetDate), -7)));
  if (sameWeekday) return sameWeekday.get(entityKey) ?? 0;
  return sumRecentQuantity(quantityByDate, entityKey, targetDate, 7) / 7;
}

export function buildDemandTrainingExamples(data: FirstPartyTrainingData): FeatureExample[] {
  const completedOrders = data.orders.filter(isCompletedOrder).sort((first, second) => orderActivityAt(first).getTime() - orderActivityAt(second).getTime());
  if (!completedOrders.length) return [];

  const entities = demandEntities(data);
  const quantityByDate = demandQuantityIndex(completedOrders);
  const earliest = startOfDay(orderActivityAt(completedOrders[0]!));
  const latestObserved = startOfDay(orderActivityAt(completedOrders[completedOrders.length - 1]!));
  const latestMatured = addDays(startOfDay(data.now), -1);
  const latest = latestObserved < latestMatured ? latestObserved : latestMatured;
  const firstTrainingDay = addDays(earliest, 30);
  if (firstTrainingDay > latest) return [];
  const bounds = intelligenceTrainingBounds("demand");
  const rowBudget = bounds.maximumTrainRows + bounds.maximumValidationRows;
  const maximumDays = Math.max(1, Math.floor(rowBudget / Math.max(1, entities.length)));
  const boundedFirstDay = addDays(latest, -(maximumDays - 1));
  const trainingStart = boundedFirstDay > firstTrainingDay ? boundedFirstDay : firstTrainingDay;

  return dateRange(trainingStart, latest).flatMap((day) =>
    entities.map((entity) => ({
      entityId: entity.entityId,
      entityType: "menu_item",
      label: quantityByDate.get(dateKey(day))?.get(entity.key) ?? 0,
      labelAvailableAt: addDays(day, 1),
      baselinePrediction: demandBaselinePrediction(quantityByDate, entity.key, day),
      features: demandFeatures({ data, quantityByDate, entity, targetDate: day }),
      observedAt: day,
      metadata: {
        itemName: entity.itemName,
        categoryName: entity.categoryName,
        forecastDate: day.toISOString().slice(0, 10),
        businessFamily: intelligenceBusinessProfile(data.business.businessType).family,
        labelHorizonDays: 1,
        recent30Quantity: sumRecentQuantity(quantityByDate, entity.key, day, 30)
      }
    }))
  );
}

export function buildDemandPredictionExamples(data: FirstPartyTrainingData, targetDate = addDays(startOfDay(data.now), 1)): FeatureExample[] {
  const quantityByDate = demandQuantityIndex(data.orders);

  return demandEntities(data)
    .filter((entity) => entity.isAvailable)
    .map((entity) => ({
      entityId: entity.entityId,
      entityType: "menu_item",
      features: demandFeatures({ data, quantityByDate, entity, targetDate }),
      observedAt: targetDate,
      metadata: {
        itemName: entity.itemName,
        categoryName: entity.categoryName,
        forecastDate: targetDate.toISOString().slice(0, 10),
        businessFamily: intelligenceBusinessProfile(data.business.businessType).family,
        recent30Quantity: sumRecentQuantity(quantityByDate, entity.key, targetDate, 30)
      }
    }));
}

function customerOrders(data: FirstPartyTrainingData, customerId: string, before?: Date, after?: Date) {
  return data.orders
    .filter((order) => order.customerId === customerId && !isCancelledOrder(order))
    .filter((order) => (before ? orderActivityAt(order) < before : true))
    .filter((order) => (after ? orderActivityAt(order) >= after : true))
    .sort((first, second) => orderActivityAt(first).getTime() - orderActivityAt(second).getTime());
}

function customerPayments(data: FirstPartyTrainingData, customerId: string, before?: Date) {
  return data.payments.filter((payment) => payment.customerId === customerId && (!before || payment.createdAt < before));
}

function retentionFeatures(data: FirstPartyTrainingData, customer: FirstPartyCustomerRecord, referenceDate: Date) {
  const orders = customerOrders(data, customer.id, referenceDate);
  if (!orders.length) return null;

  const firstOrderAt = orderActivityAt(orders[0]!);
  const lastOrderAt = orderActivityAt(orders[orders.length - 1]!);
  const totalSpent = orders.reduce((sum, order) => sum + order.totalAmount, 0);
  const payments = customerPayments(data, customer.id, referenceDate);
  const firstOrderAgeDays = Math.max(1, daysBetween(firstOrderAt, referenceDate));
  const totalOrders = orders.length;

  return {
    totalOrders: logFeature(totalOrders),
    daysSinceLastOrder: daysBetween(lastOrderAt, referenceDate) / 365,
    averageOrderValue: logFeature(totalSpent / totalOrders),
    paymentSuccessRate: payments.length
      ? ratio(payments.filter((payment) => isSuccessfulPaymentBy(payment, referenceDate)).length, payments.length)
      : 0,
    firstOrderAgeDays: firstOrderAgeDays / 365,
    orderFrequency: totalOrders / Math.max(1, firstOrderAgeDays / 30),
    [categoricalFeature("businessFamily", intelligenceBusinessProfile(data.business.businessType).family)]: 1
  };
}

export function buildRetentionTrainingExamples(data: FirstPartyTrainingData): FeatureExample[] {
  const activeOrders = data.orders.filter((order) => !isCancelledOrder(order)).sort((first, second) => orderActivityAt(first).getTime() - orderActivityAt(second).getTime());
  if (activeOrders.length < 2) return [];

  const profile = intelligenceBusinessProfile(data.business.businessType);
  const horizonDays = profile.retentionHorizonDays;
  const firstDate = addDays(startOfDay(orderActivityAt(activeOrders[0]!)), 30);
  const lastDate = addDays(startOfDay(orderActivityAt(activeOrders[activeOrders.length - 1]!)), -horizonDays);
  if (firstDate > lastDate) return [];

  const referenceDates: Date[] = [];
  for (let referenceDate = firstDate; referenceDate <= lastDate; referenceDate = addDays(referenceDate, 7)) {
    referenceDates.push(referenceDate);
  }
  const recentReferenceDates = referenceDates.slice(-52);
  const bounds = intelligenceTrainingBounds("retention");
  const rowBudget = bounds.maximumTrainRows + bounds.maximumValidationRows;
  const maximumCustomers = Math.max(1, Math.floor(rowBudget / Math.max(1, recentReferenceDates.length)));
  const boundedCustomers = boundedChronologicalRows(data.customers, maximumCustomers);

  const examples: FeatureExample[] = [];
  for (const referenceDate of recentReferenceDates) {
    boundedCustomers.forEach((customer) => {
      const features = retentionFeatures(data, customer, referenceDate);
      if (!features) return;

      const labelAvailableAt = addDays(referenceDate, horizonDays);
      const returned = customerOrders(data, customer.id, labelAvailableAt, referenceDate).length > 0;
      examples.push({
        entityId: customer.id,
        entityType: "customer",
        label: returned ? 1 : 0,
        labelAvailableAt,
        features,
        observedAt: referenceDate,
        metadata: {
          customerName: customer.name,
          referenceDate: referenceDate.toISOString().slice(0, 10),
          businessFamily: profile.family,
          labelHorizonDays: horizonDays
        }
      });
    });
  }

  return examples;
}

export function buildRetentionPredictionExamples(data: FirstPartyTrainingData): FeatureExample[] {
  const examples: FeatureExample[] = [];

  data.customers.forEach((customer) => {
    const features = retentionFeatures(data, customer, data.now);
    if (!features) return;

    examples.push({
      entityId: customer.id,
      entityType: "customer",
      features,
      observedAt: data.now,
      metadata: {
        customerName: customer.name,
        businessFamily: intelligenceBusinessProfile(data.business.businessType).family,
        daysSinceLastOrder: customer.lastOrderAt ? daysBetween(customer.lastOrderAt, data.now) : null,
        totalOrders: customer.totalOrders
      }
    });
  });

  return examples;
}

function priorPaymentsForCustomer(data: FirstPartyTrainingData, customerId: string, before: Date) {
  return data.payments
    .filter(
      (payment) =>
        payment.customerId === customerId &&
        payment.createdAt < before &&
        isResolvedPayment(payment) &&
        paymentOutcomeAvailableAt(payment).getTime() <= before.getTime()
    )
    .sort((first, second) => first.createdAt.getTime() - second.createdAt.getTime());
}

function paymentRiskFeatures(data: FirstPartyTrainingData, payment: FirstPartyPaymentRecord) {
  const previousPayments = priorPaymentsForCustomer(data, payment.customerId, payment.createdAt);
  const successfulPrevious = previousPayments.filter(isSuccessfulPayment).length;
  const failedPrevious = previousPayments.filter(isFailedPayment).length;

  return {
    orderValue: logFeature(payment.amount),
    previousPaymentSuccessRatio: previousPayments.length ? ratio(successfulPrevious, previousPayments.length) : 0,
    priorFailedCount: logFeature(failedPrevious),
    [categoricalFeature("businessFamily", intelligenceBusinessProfile(data.business.businessType).family)]: 1,
    [categoricalFeature("paymentMethod", payment.provider)]: 1
  };
}

export function buildPaymentRiskTrainingExamples(data: FirstPartyTrainingData): FeatureExample[] {
  return data.payments
    .filter(isResolvedPayment)
    .slice()
    .sort((first, second) => first.createdAt.getTime() - second.createdAt.getTime())
    .map((payment) => ({
      entityId: payment.id,
      entityType: "payment",
      label: isFailedPayment(payment) ? 1 : 0,
      labelAvailableAt: paymentOutcomeAvailableAt(payment),
      features: paymentRiskFeatures(data, payment),
      observedAt: payment.createdAt,
      metadata: {
        orderId: payment.orderId,
        customerId: payment.customerId,
        amount: payment.amount,
        status: payment.status,
        provider: payment.provider,
        businessFamily: intelligenceBusinessProfile(data.business.businessType).family
      }
    }));
}

export function buildPaymentRiskPredictionExamples(data: FirstPartyTrainingData): FeatureExample[] {
  return data.payments
    .filter((payment) => payment.status === "PENDING")
    .sort((first, second) => second.createdAt.getTime() - first.createdAt.getTime())
    .slice(0, 100)
    .map((payment) => ({
      entityId: payment.id,
      entityType: "payment",
      features: paymentRiskFeatures(data, payment),
      observedAt: data.now,
      metadata: {
        orderId: payment.orderId,
        customerId: payment.customerId,
        amount: payment.amount,
        status: payment.status,
        provider: payment.provider,
        businessFamily: intelligenceBusinessProfile(data.business.businessType).family
      }
    }));
}
