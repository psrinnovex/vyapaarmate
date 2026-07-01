import { stableHash, type FeatureExample, type FeatureMap, type IntelligenceModelType, type ModelReadiness } from "@/lib/intelligence/ml/model-registry";

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
  orderStatus: string;
  orderPaymentStatus: string;
  createdAt: Date;
  paidAt: Date | null;
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
  customerCount: number;
  customerLinkedOrders: number;
  paymentCount: number;
  completedPayments: number;
  failedOrPendingPayments: number;
  dataStart: Date | null;
  dataEnd: Date | null;
};

const dayMs = 24 * 60 * 60 * 1000;

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function daysBetween(from: Date, to: Date) {
  return Math.max(0, Math.floor((startOfDay(to).getTime() - startOfDay(from).getTime()) / dayMs));
}

function dateKey(date: Date) {
  return startOfDay(date).toISOString().slice(0, 10);
}

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

function isRiskPayment(payment: Pick<FirstPartyPaymentRecord, "status"> | { status: string }) {
  return payment.status === "PENDING" || payment.status === "FAILED" || payment.status === "REFUNDED";
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

function orderTimes(orders: FirstPartyOrderRecord[]) {
  return orders.map((order) => order.createdAt.getTime()).filter(Number.isFinite);
}

export function buildFirstPartyDataProfile(data: FirstPartyTrainingData): FirstPartyDataProfile {
  const completedLinkedOrders = data.orders.filter((order) => isCompletedOrder(order) && order.items.some((item) => item.menuItemId)).length;
  const completedLinkedOrderItems = data.orders
    .filter(isCompletedOrder)
    .reduce((count, order) => count + order.items.filter((item) => item.menuItemId).length, 0);
  const completedLinkedOrderDates = data.orders
    .filter((order) => isCompletedOrder(order) && order.items.some((item) => item.menuItemId))
    .map((order) => startOfDay(order.createdAt).getTime());
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
    customerCount: data.customers.length,
    customerLinkedOrders: data.orders.filter((order) => Boolean(order.customerId) && !isCancelledOrder(order)).length,
    paymentCount: data.payments.length,
    completedPayments: data.payments.filter(isSuccessfulPayment).length,
    failedOrPendingPayments: data.payments.filter(isRiskPayment).length,
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
    const ready = historyGate.met || completedOrdersGate.met;

    return {
      modelType,
      status: ready ? "ready_for_training" : "needs_data",
      rowsAvailable: profile.completedLinkedOrderItems,
      trainingDataStart: profile.dataStart,
      trainingDataEnd: profile.dataEnd,
      gates: [historyGate, completedOrdersGate],
      missingRequirements: ready
        ? []
        : [
            `Demand forecasting needs either ${historyGate.missing} more days of completed order history or ${completedOrdersGate.missing} more completed orders with linked order items.`
          ]
    };
  }

  if (modelType === "retention") {
    const customerGate = readinessGate("customers", "Customers", profile.customerCount, 100, "customers");
    const orderGate = readinessGate("customer_linked_orders", "Customer-linked orders", profile.customerLinkedOrders, 300, "orders");
    const ready = customerGate.met || orderGate.met;

    return {
      modelType,
      status: ready ? "ready_for_training" : "needs_data",
      rowsAvailable: Math.max(profile.customerCount, profile.customerLinkedOrders),
      trainingDataStart: profile.dataStart,
      trainingDataEnd: profile.dataEnd,
      gates: [customerGate, orderGate],
      missingRequirements: ready
        ? []
        : [`Retention modeling needs either ${customerGate.missing} more customers or ${orderGate.missing} more customer-linked orders.`]
    };
  }

  const totalGate = readinessGate("payments", "Payment examples", profile.paymentCount, 300, "payments");
  const successGate = readinessGate("successful_payments", "Successful payment examples", profile.completedPayments, 50, "payments");
  const riskGate = readinessGate("failed_or_pending_payments", "Failed or pending payment examples", profile.failedOrPendingPayments, 30, "payments");
  const ready = totalGate.met && successGate.met && riskGate.met;

  return {
    modelType,
    status: ready ? "ready_for_training" : "needs_data",
    rowsAvailable: profile.paymentCount,
    trainingDataStart: profile.dataStart,
    trainingDataEnd: profile.dataEnd,
    gates: [totalGate, successGate, riskGate],
    missingRequirements: ready
      ? []
      : [
          `Payment risk needs ${totalGate.missing} more payments, ${successGate.missing} more successful payments, and ${riskGate.missing} more failed or pending examples.`
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
    const key = dateKey(order.createdAt);
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
  return orders.filter((order) => !isCancelledOrder(order) && order.createdAt >= start && order.createdAt < end);
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
    ? ratio(prior30Payments.filter(isSuccessfulPayment).length, prior30Payments.length)
    : ratio(prior30Orders.filter((order) => order.paymentStatus === "COMPLETED" || order.paymentStatus === "PAID").length, prior30Orders.length);

  return {
    dayOfWeek: day.getDay() / 6,
    isWeekend: day.getDay() === 0 || day.getDay() === 6 ? 1 : 0,
    weekOfMonth: Math.ceil(day.getDate() / 7) / 5,
    month: (day.getMonth() + 1) / 12,
    recent7Quantity: logFeature(sumRecentQuantity(quantityByDate, entity.key, day, 7)),
    recent14Quantity: logFeature(sumRecentQuantity(quantityByDate, entity.key, day, 14)),
    recent30Quantity: logFeature(sumRecentQuantity(quantityByDate, entity.key, day, 30)),
    averageOrderValue: logFeature(averageOrderValue),
    paymentSuccessRatio,
    orderCountTrend: normalizedTrend(prior7Orders.length, previous7Orders.length),
    [categoricalFeature("item", entity.key)]: 1,
    [categoricalFeature("category", entity.categoryKey)]: 1
  };
}

export function buildDemandTrainingExamples(data: FirstPartyTrainingData): FeatureExample[] {
  const completedOrders = data.orders.filter(isCompletedOrder).sort((first, second) => first.createdAt.getTime() - second.createdAt.getTime());
  if (!completedOrders.length) return [];

  const entities = demandEntities(data);
  const quantityByDate = demandQuantityIndex(completedOrders);
  const earliest = startOfDay(completedOrders[0]!.createdAt);
  const latest = startOfDay(completedOrders[completedOrders.length - 1]!.createdAt);
  const firstTrainingDay = addDays(earliest, 30);

  return dateRange(firstTrainingDay, latest).flatMap((day) =>
    entities.map((entity) => ({
      entityId: entity.entityId,
      entityType: "menu_item",
      label: quantityByDate.get(dateKey(day))?.get(entity.key) ?? 0,
      features: demandFeatures({ data, quantityByDate, entity, targetDate: day }),
      observedAt: day,
      metadata: {
        itemName: entity.itemName,
        categoryName: entity.categoryName,
        forecastDate: day.toISOString().slice(0, 10),
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
        recent30Quantity: sumRecentQuantity(quantityByDate, entity.key, targetDate, 30)
      }
    }));
}

function customerOrders(data: FirstPartyTrainingData, customerId: string, before?: Date, after?: Date) {
  return data.orders
    .filter((order) => order.customerId === customerId && !isCancelledOrder(order))
    .filter((order) => (before ? order.createdAt < before : true))
    .filter((order) => (after ? order.createdAt >= after : true))
    .sort((first, second) => first.createdAt.getTime() - second.createdAt.getTime());
}

function customerPayments(data: FirstPartyTrainingData, customerId: string, before?: Date) {
  return data.payments.filter((payment) => payment.customerId === customerId && (!before || payment.createdAt < before));
}

function retentionFeatures(data: FirstPartyTrainingData, customer: FirstPartyCustomerRecord, referenceDate: Date) {
  const orders = customerOrders(data, customer.id, referenceDate);
  if (!orders.length) return null;

  const firstOrderAt = orders[0]!.createdAt;
  const lastOrderAt = orders[orders.length - 1]!.createdAt;
  const totalSpent = orders.reduce((sum, order) => sum + order.totalAmount, 0);
  const payments = customerPayments(data, customer.id, referenceDate);
  const firstOrderAgeDays = Math.max(1, daysBetween(firstOrderAt, referenceDate));
  const totalOrders = orders.length;

  return {
    totalOrders: logFeature(totalOrders),
    daysSinceLastOrder: daysBetween(lastOrderAt, referenceDate) / 365,
    averageOrderValue: logFeature(totalSpent / totalOrders),
    paymentSuccessRate: payments.length ? ratio(payments.filter(isSuccessfulPayment).length, payments.length) : 0,
    firstOrderAgeDays: firstOrderAgeDays / 365,
    orderFrequency: totalOrders / Math.max(1, firstOrderAgeDays / 30)
  };
}

export function buildRetentionTrainingExamples(data: FirstPartyTrainingData): FeatureExample[] {
  const activeOrders = data.orders.filter((order) => !isCancelledOrder(order)).sort((first, second) => first.createdAt.getTime() - second.createdAt.getTime());
  if (activeOrders.length < 2) return [];

  const firstDate = addDays(startOfDay(activeOrders[0]!.createdAt), 30);
  const lastDate = addDays(startOfDay(activeOrders[activeOrders.length - 1]!.createdAt), -30);
  if (firstDate > lastDate) return [];

  const examples: FeatureExample[] = [];
  for (let referenceDate = firstDate; referenceDate <= lastDate; referenceDate = addDays(referenceDate, 7)) {
    data.customers.forEach((customer) => {
      const features = retentionFeatures(data, customer, referenceDate);
      if (!features) return;

      const returned = customerOrders(data, customer.id, addDays(referenceDate, 30), referenceDate).length > 0;
      examples.push({
        entityId: customer.id,
        entityType: "customer",
        label: returned ? 1 : 0,
        features,
        observedAt: referenceDate,
        metadata: {
          customerName: customer.name,
          referenceDate: referenceDate.toISOString().slice(0, 10)
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
        daysSinceLastOrder: customer.lastOrderAt ? daysBetween(customer.lastOrderAt, data.now) : null,
        totalOrders: customer.totalOrders
      }
    });
  });

  return examples;
}

function priorPaymentsForCustomer(data: FirstPartyTrainingData, customerId: string, before: Date) {
  return data.payments
    .filter((payment) => payment.customerId === customerId && payment.createdAt < before)
    .sort((first, second) => first.createdAt.getTime() - second.createdAt.getTime());
}

function paymentRiskFeatures(data: FirstPartyTrainingData, payment: FirstPartyPaymentRecord) {
  const previousPayments = priorPaymentsForCustomer(data, payment.customerId, payment.createdAt);
  const successfulPrevious = previousPayments.filter(isSuccessfulPayment).length;
  const pendingFailedPrevious = previousPayments.filter(isRiskPayment).length;

  return {
    orderValue: logFeature(payment.amount),
    previousPaymentSuccessRatio: previousPayments.length ? ratio(successfulPrevious, previousPayments.length) : 0,
    pendingFailedCount: logFeature(pendingFailedPrevious),
    paymentAgeDays: daysBetween(payment.createdAt, data.now) / 365,
    [categoricalFeature("paymentMethod", payment.provider)]: 1,
    [categoricalFeature("orderStatus", payment.orderStatus)]: 1,
    [categoricalFeature("paymentStatus", payment.status || payment.orderPaymentStatus)]: 1
  };
}

export function buildPaymentRiskTrainingExamples(data: FirstPartyTrainingData): FeatureExample[] {
  return data.payments
    .slice()
    .sort((first, second) => first.createdAt.getTime() - second.createdAt.getTime())
    .map((payment) => ({
      entityId: payment.id,
      entityType: "payment",
      label: isSuccessfulPayment(payment) ? 0 : 1,
      features: paymentRiskFeatures(data, payment),
      observedAt: payment.createdAt,
      metadata: {
        orderId: payment.orderId,
        customerId: payment.customerId,
        amount: payment.amount,
        status: payment.status,
        provider: payment.provider
      }
    }));
}

export function buildPaymentRiskPredictionExamples(data: FirstPartyTrainingData): FeatureExample[] {
  return data.payments
    .filter((payment) => isRiskPayment(payment) || daysBetween(payment.createdAt, data.now) <= 14)
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
        provider: payment.provider
      }
    }));
}
