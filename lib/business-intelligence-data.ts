import { prisma } from "@/lib/prisma";
import {
  buildBusinessIntelligenceArtifacts,
  type BusinessIntelligenceArtifacts,
  type BusinessIntelligenceDataset,
  type BusinessIntelligencePayload
} from "@/lib/business-intelligence";
import { LiveDataNotFoundError } from "@/lib/live-data";

type IntelligenceProductRow = {
  id: string;
  name: string;
  isAvailable: boolean;
  category: { name: string };
};

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDaysFrom(date: Date, days: number, hour: number, minute = 0) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  copy.setHours(hour, minute, 0, 0);
  return copy;
}

function fallbackProductsForBusiness(businessType: string) {
  const normalized = businessType.toLowerCase();
  if (/(salon|spa|beauty)/.test(normalized)) {
    return [
      { id: "demo_service_haircut", name: "Haircut", category: "Services", isAvailable: true },
      { id: "demo_service_hair_spa", name: "Hair Spa", category: "Services", isAvailable: true },
      { id: "demo_service_facial", name: "Facial", category: "Services", isAvailable: true },
      { id: "demo_service_grooming", name: "Grooming Package", category: "Services", isAvailable: true }
    ];
  }
  if (/(grocery|pharmacy|retail|store)/.test(normalized)) {
    return [
      { id: "demo_product_essentials", name: "Daily Essentials Kit", category: "Essentials", isAvailable: true },
      { id: "demo_product_fruit", name: "Fresh Fruit Pack", category: "Fresh", isAvailable: true },
      { id: "demo_product_milk", name: "Milk and Bread Combo", category: "Essentials", isAvailable: true },
      { id: "demo_product_snacks", name: "Evening Snacks Pack", category: "Snacks", isAvailable: true }
    ];
  }
  return [
    { id: "demo_food_idli", name: "Ghee Idli Combo", category: "Breakfast", isAvailable: true },
    { id: "demo_food_dosa", name: "Masala Dosa", category: "Breakfast", isAvailable: true },
    { id: "demo_food_meals", name: "Mini Meals", category: "Meals", isAvailable: true },
    { id: "demo_food_snack", name: "Evening Snack Plate", category: "Snacks", isAvailable: true }
  ];
}

function buildDemoBusinessIntelligenceDataset({
  business,
  products,
  now
}: {
  business: BusinessIntelligenceDataset["business"];
  products: IntelligenceProductRow[];
  now: Date;
}): BusinessIntelligenceDataset {
  const catalog = products.length
    ? products.slice(0, 4).map((product) => ({
        id: product.id,
        name: product.name,
        category: product.category.name,
        isAvailable: product.isAvailable
      }))
    : fallbackProductsForBusiness(business.businessType);
  const [firstProduct, secondProduct, thirdProduct, fourthProduct] = catalog;
  const base = new Date(now);
  base.setHours(0, 0, 0, 0);
  const orderDate = (daysFromToday: number, hour: number, minute = 0) => addDaysFrom(base, daysFromToday, hour, minute);
  const orderItems = [
    { productId: firstProduct?.id ?? null, productName: firstProduct?.name ?? "Popular Item", quantity: 18, total: 1620 },
    { productId: secondProduct?.id ?? null, productName: secondProduct?.name ?? "Regular Item", quantity: 12, total: 1320 }
  ];

  return {
    source: "demo",
    business,
    products: catalog,
    customers: [
      {
        id: "demo_customer_ananya",
        name: "Ananya Rao",
        phone: "+919810000001",
        totalOrders: 7,
        totalSpent: 2260,
        lastOrderAt: orderDate(-6, 8, 10),
        whatsappOptIn: true,
        marketingOptIn: true,
        preferredProducts: [firstProduct?.name ?? "Popular Item", secondProduct?.name ?? "Regular Item"]
      },
      {
        id: "demo_customer_ramesh",
        name: "Ramesh Kumar",
        phone: "+919810000002",
        totalOrders: 5,
        totalSpent: 1640,
        lastOrderAt: orderDate(-9, 18, 20),
        whatsappOptIn: true,
        marketingOptIn: true,
        preferredProducts: [fourthProduct?.name ?? secondProduct?.name ?? "Evening Item"]
      },
      {
        id: "demo_customer_meena",
        name: "Meena Iyer",
        phone: "+919810000003",
        totalOrders: 2,
        totalSpent: 620,
        lastOrderAt: orderDate(-2, 13, 5),
        whatsappOptIn: true,
        marketingOptIn: false,
        preferredProducts: [thirdProduct?.name ?? "Lunch Item"]
      },
      {
        id: "demo_customer_kiran",
        name: "Kiran Patel",
        phone: "+919810000004",
        totalOrders: 10,
        totalSpent: 3920,
        lastOrderAt: orderDate(-34, 8, 15),
        whatsappOptIn: true,
        marketingOptIn: true,
        preferredProducts: [firstProduct?.name ?? "Popular Item"]
      }
    ],
    orders: [
      {
        id: "demo_order_weekday_1",
        customerId: "demo_customer_ananya",
        customerName: "Ananya Rao",
        customerPhone: "+919810000001",
        status: "DELIVERED",
        paymentStatus: "COMPLETED",
        totalAmount: 2940,
        createdAt: orderDate(-27, 8, 10),
        orderType: "PICKUP",
        items: orderItems
      },
      {
        id: "demo_order_weekday_2",
        customerId: "demo_customer_ramesh",
        customerName: "Ramesh Kumar",
        customerPhone: "+919810000002",
        status: "DELIVERED",
        paymentStatus: "COMPLETED",
        totalAmount: 3510,
        createdAt: orderDate(-20, 8, 25),
        orderType: "PICKUP",
        items: [
          { productId: firstProduct?.id ?? null, productName: firstProduct?.name ?? "Popular Item", quantity: 22, total: 1980 },
          { productId: secondProduct?.id ?? null, productName: secondProduct?.name ?? "Regular Item", quantity: 14, total: 1530 }
        ]
      },
      {
        id: "demo_order_weekday_3",
        customerId: "demo_customer_ananya",
        customerName: "Ananya Rao",
        customerPhone: "+919810000001",
        status: "DELIVERED",
        paymentStatus: "COMPLETED",
        totalAmount: 4380,
        createdAt: orderDate(-13, 8, 15),
        orderType: "PICKUP",
        items: [
          { productId: firstProduct?.id ?? null, productName: firstProduct?.name ?? "Popular Item", quantity: 26, total: 2340 },
          { productId: secondProduct?.id ?? null, productName: secondProduct?.name ?? "Regular Item", quantity: 18, total: 2040 }
        ]
      },
      {
        id: "demo_order_weekday_4",
        customerId: "demo_customer_meena",
        customerName: "Meena Iyer",
        customerPhone: "+919810000003",
        status: "DELIVERED",
        paymentStatus: "COMPLETED",
        totalAmount: 1680,
        createdAt: orderDate(-6, 13, 5),
        orderType: "PICKUP",
        items: [{ productId: thirdProduct?.id ?? null, productName: thirdProduct?.name ?? "Lunch Item", quantity: 8, total: 1680 }]
      },
      {
        id: "demo_order_evening",
        customerId: "demo_customer_ramesh",
        customerName: "Ramesh Kumar",
        customerPhone: "+919810000002",
        status: "DELIVERED",
        paymentStatus: "COMPLETED",
        totalAmount: 1260,
        createdAt: orderDate(-9, 18, 20),
        orderType: "PICKUP",
        items: [{ productId: fourthProduct?.id ?? null, productName: fourthProduct?.name ?? "Evening Item", quantity: 9, total: 1260 }]
      },
      {
        id: "demo_order_pending",
        customerId: "demo_customer_meena",
        customerName: "Meena Iyer",
        customerPhone: "+919810000003",
        status: "ACCEPTED",
        paymentStatus: "PENDING",
        totalAmount: 620,
        createdAt: orderDate(-2, 13, 5),
        orderType: "PICKUP",
        items: [{ productId: thirdProduct?.id ?? null, productName: thirdProduct?.name ?? "Lunch Item", quantity: 3, total: 620 }]
      }
    ],
    payments: [
      {
        id: "demo_payment_current",
        orderId: "demo_order_weekday_4",
        customerId: "demo_customer_meena",
        customerName: "Meena Iyer",
        customerPhone: "+919810000003",
        amount: 1680,
        status: "COMPLETED",
        provider: "CASHFREE",
        createdAt: orderDate(-6, 13, 10),
        paidAt: orderDate(-6, 13, 15),
        customerTotalOrders: 2,
        customerTotalSpent: 620
      },
      {
        id: "demo_payment_previous",
        orderId: "demo_order_weekday_3",
        customerId: "demo_customer_ananya",
        customerName: "Ananya Rao",
        customerPhone: "+919810000001",
        amount: 4380,
        status: "COMPLETED",
        provider: "CASHFREE",
        createdAt: orderDate(-13, 8, 20),
        paidAt: orderDate(-13, 8, 22),
        customerTotalOrders: 7,
        customerTotalSpent: 2260
      },
      {
        id: "demo_payment_pending",
        orderId: "demo_order_pending",
        customerId: "demo_customer_meena",
        customerName: "Meena Iyer",
        customerPhone: "+919810000003",
        amount: 620,
        status: "PENDING",
        provider: "UPI",
        createdAt: orderDate(-2, 13, 5),
        paidAt: null,
        customerTotalOrders: 2,
        customerTotalSpent: 620
      }
    ],
    now
  };
}

export async function getBusinessIntelligenceDataset(businessId: string): Promise<BusinessIntelligenceDataset> {
  const now = new Date();
  const historyStart = daysAgo(45);
  const paymentStart = daysAgo(14);
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, businessType: true }
  });

  if (!business) {
    throw new LiveDataNotFoundError(`Business ${businessId} was not found for AI suggestions.`);
  }

  const [products, orders, customers, payments] = await Promise.all([
    prisma.menuItem.findMany({
      where: { businessId },
      orderBy: [{ isAvailable: "desc" }, { isBestSeller: "desc" }, { updatedAt: "desc" }],
      take: 120,
      select: {
        id: true,
        name: true,
        isAvailable: true,
        category: { select: { name: true } }
      }
    }),
    prisma.order.findMany({
      where: { businessId, createdAt: { gte: historyStart } },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        customerId: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        orderType: true,
        createdAt: true,
        customer: { select: { name: true, phone: true } },
        items: {
          select: {
            menuItemId: true,
            itemName: true,
            quantity: true,
            total: true
          }
        }
      }
    }),
    prisma.customer.findMany({
      where: { businessId },
      orderBy: [{ lastOrderAt: "desc" }, { totalOrders: "desc" }],
      take: 500,
      select: {
        id: true,
        name: true,
        phone: true,
        totalOrders: true,
        totalSpent: true,
        lastOrderAt: true,
        whatsappOptIn: true,
        marketingOptIn: true,
        orders: {
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            items: { select: { itemName: true, quantity: true } }
          }
        }
      }
    }),
    prisma.payment.findMany({
      where: {
        businessId,
        OR: [{ status: "PENDING" }, { createdAt: { gte: paymentStart } }]
      },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        id: true,
        orderId: true,
        amount: true,
        status: true,
        provider: true,
        createdAt: true,
        paidAt: true,
        order: {
          select: {
            customerId: true,
            customer: {
              select: {
                name: true,
                phone: true,
                totalOrders: true,
                totalSpent: true
              }
            }
          }
        }
      }
    })
  ]);

  const preferredProductsByCustomer = new Map<string, string[]>();
  customers.forEach((customer) => {
    const counts = new Map<string, number>();
    customer.orders.forEach((order) => {
      order.items.forEach((item) => {
        counts.set(item.itemName, (counts.get(item.itemName) ?? 0) + item.quantity);
      });
    });
    preferredProductsByCustomer.set(
      customer.id,
      Array.from(counts.entries())
        .sort((first, second) => second[1] - first[1])
        .slice(0, 3)
        .map(([name]) => name)
    );
  });

  const dataset: BusinessIntelligenceDataset = {
    source: "database",
    business,
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category.name,
      isAvailable: product.isAvailable
    })),
    orders: orders.map((order) => ({
      id: order.id,
      customerId: order.customerId,
      customerName: order.customer.name,
      customerPhone: order.customer.phone,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: Number(order.totalAmount),
      createdAt: order.createdAt,
      orderType: order.orderType,
      items: order.items.map((item) => ({
        productId: item.menuItemId,
        productName: item.itemName,
        quantity: item.quantity,
        total: Number(item.total)
      }))
    })),
    customers: customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      totalOrders: customer.totalOrders,
      totalSpent: Number(customer.totalSpent),
      lastOrderAt: customer.lastOrderAt,
      whatsappOptIn: customer.whatsappOptIn,
      marketingOptIn: customer.marketingOptIn,
      preferredProducts: preferredProductsByCustomer.get(customer.id) ?? []
    })),
    payments: payments.map((payment) => ({
      id: payment.id,
      orderId: payment.orderId,
      customerId: payment.order.customerId,
      customerName: payment.order.customer.name,
      customerPhone: payment.order.customer.phone,
      amount: Number(payment.amount),
      status: payment.status,
      provider: payment.provider,
      createdAt: payment.createdAt,
      paidAt: payment.paidAt,
      customerTotalOrders: payment.order.customer.totalOrders,
      customerTotalSpent: Number(payment.order.customer.totalSpent)
    })),
    now
  };

  const hasRealActivity = orders.length > 0 || customers.length > 0 || payments.length > 0;
  if (!hasRealActivity) {
    return buildDemoBusinessIntelligenceDataset({ business, products, now });
  }

  return dataset;
}

export async function getBusinessIntelligenceArtifacts(businessId: string): Promise<BusinessIntelligenceArtifacts> {
  return buildBusinessIntelligenceArtifacts(await getBusinessIntelligenceDataset(businessId));
}

export async function getBusinessIntelligencePayload(businessId: string): Promise<BusinessIntelligencePayload> {
  return (await getBusinessIntelligenceArtifacts(businessId)).payload;
}
