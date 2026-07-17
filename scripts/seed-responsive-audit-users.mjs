import { randomBytes } from "node:crypto";
import nextEnv from "@next/env";
import bcrypt from "bcryptjs";
import prismaPkg from "@prisma/client";

const { loadEnvConfig } = nextEnv;
const { PrismaClient } = prismaPkg;

loadEnvConfig(process.cwd());

let prisma;
const seedProvenance = { dataOrigin: "SEED", trainingEligible: false };

const audit = {
  businessSlug: "audit-business",
  businessName: "Audit Business",
  ownerEmail: "audit.owner@example.test",
  adminEmail: "audit.admin@example.test",
  supportEmail: "audit.support@example.test"
};

function looksLikePlaceholderValue(value) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.startsWith("your-") ||
    normalized.startsWith("replace-") ||
    normalized.includes("placeholder") ||
    normalized === "todo" ||
    normalized === "changeme" ||
    normalized === "change-me" ||
    normalized === "example"
  );
}

function assertLocalDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. Point it at your local development database before seeding responsive audit users.");
  }
  if (looksLikePlaceholderValue(databaseUrl)) {
    throw new Error("DATABASE_URL still looks like a placeholder. Refusing to seed responsive audit users.");
  }

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }

  if (!["postgresql:", "postgres:"].includes(parsed.protocol)) {
    throw new Error(`DATABASE_URL must use postgresql:// or postgres://. Received protocol: ${parsed.protocol}`);
  }

  const detectedHost = parsed.hostname.replace(/^\[|\]$/g, "");
  const isLocalHost = ["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(detectedHost);
  if (isLocalHost) return;

  const allowRemoteSeed = process.env.ALLOW_RESPONSIVE_AUDIT_REMOTE_SEED === "1";
  const confirmedRemoteHost = process.env.RESPONSIVE_AUDIT_CONFIRM_REMOTE_HOST?.trim();
  if (!allowRemoteSeed || confirmedRemoteHost !== detectedHost) {
    throw new Error(remoteSeedRefusalMessage(detectedHost, { allowRemoteSeed, confirmedRemoteHost }));
  }

  console.warn(
    [
      "!!! DANGEROUS REMOTE RESPONSIVE AUDIT SEED OVERRIDE ENABLED !!!",
      `Detected DB host: ${detectedHost}`,
      "This script is about to write fake responsive audit users and business data to a remote database.",
      "Continue only if this is a disposable staging database, never production."
    ].join("\n")
  );
}

function remoteSeedRefusalMessage(detectedHost, { allowRemoteSeed, confirmedRemoteHost }) {
  const lines = [
    "Refusing to seed responsive audit users into a non-local database.",
    `Detected DB host: ${detectedHost}`,
    "",
    "Why this refused:",
    "The responsive audit seed mutates users, businesses, menus, orders, payments, subscriptions, and support tickets.",
    "DATABASE_URL is not localhost, 127.0.0.1, ::1, or 0.0.0.0, so this could write audit fixture data to hosted Supabase.",
    "",
    "Run with local Supabase:",
    "1. npx supabase start",
    "2. npx supabase status",
    "3. export DATABASE_URL=\"postgresql://postgres:postgres@127.0.0.1:54322/postgres?schema=public\"",
    "4. export DIRECT_URL=\"$DATABASE_URL\"",
    "5. npx prisma migrate deploy",
    "6. npx prisma generate",
    "7. node scripts/seed-responsive-audit-users.mjs",
    "",
    "Disposable staging override only:",
    "Never use this for production or a shared hosted Supabase database.",
    `ALLOW_RESPONSIVE_AUDIT_REMOTE_SEED=1 RESPONSIVE_AUDIT_CONFIRM_REMOTE_HOST=${detectedHost} node scripts/seed-responsive-audit-users.mjs`
  ];

  if (allowRemoteSeed && confirmedRemoteHost !== detectedHost) {
    lines.push(
      "",
      `RESPONSIVE_AUDIT_CONFIRM_REMOTE_HOST must exactly match the detected host (${detectedHost}).`,
      `Received RESPONSIVE_AUDIT_CONFIRM_REMOTE_HOST=${confirmedRemoteHost || "(empty)"}`
    );
  }

  return lines.join("\n");
}

async function upsertAuditUser({ email, name, phone, role, businessId, passwordHash, verifiedAt }) {
  return prisma.user.upsert({
    where: { email },
    update: {
      name,
      phone,
      role,
      businessId,
      emailVerifiedAt: verifiedAt,
      phoneVerifiedAt: verifiedAt,
      passwordHash
    },
    create: {
      name,
      email,
      phone,
      role,
      businessId,
      emailVerifiedAt: verifiedAt,
      phoneVerifiedAt: verifiedAt,
      passwordHash
    }
  });
}

async function upsertMenuItem({ businessId, categoryId }) {
  const existing = await prisma.menuItem.findFirst({
    where: { businessId, name: "Audit Combo" },
    select: { id: true }
  });

  const data = {
    businessId,
    categoryId,
    ...seedProvenance,
    name: "Audit Combo",
    description: "Local responsive audit menu item.",
    price: 180,
    foodType: "VEG",
    isAvailable: true,
    isBestSeller: true
  };

  if (existing) {
    return prisma.menuItem.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.menuItem.create({ data });
}

async function upsertSubscription(businessId, now) {
  const existing = await prisma.subscription.findFirst({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    select: { id: true }
  });

  const data = {
    businessId,
    plan: "PRO",
    subtotalAmount: 2999,
    taxableAmount: 2999,
    gstRateBps: 0,
    gstAmount: 0,
    amount: 2999,
    status: "ACTIVE",
    paymentStatus: "COMPLETED",
    paymentProvider: "CASHFREE",
    paidAt: now,
    startDate: now,
    endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  };

  if (existing) {
    return prisma.subscription.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.subscription.create({ data });
}

async function main() {
  assertLocalDatabaseUrl();
  prisma = new PrismaClient();

  const now = new Date();
  const passwordHash = await bcrypt.hash(randomBytes(32).toString("base64url"), 12);

  const business = await prisma.business.upsert({
    where: { slug: audit.businessSlug },
    update: {
      name: audit.businessName,
      ownerName: "Audit Owner",
      phone: "+15550100010",
      email: "audit.business@example.test",
      address: "Audit Local Street",
      city: "Audit City",
      state: "Audit State",
      logoUrl: null,
      businessType: "Tiffin Center",
      whatsappDisplayPhone: "+15550100010",
      whatsappConnected: false,
      whatsappLiveEnabled: false,
      subscriptionPlan: "PRO",
      subscriptionStatus: "ACTIVE",
      kycStatus: "APPROVED",
      kycSubmittedAt: now,
      kycReviewedAt: now,
      isVerified: true,
      isActive: true,
      isOpen: true,
      businessHours: "9:00 AM - 9:00 PM",
      minimumOrder: 0,
      deliveryFee: 0,
      serviceRadiusKm: 0,
      acceptsPickup: true,
      acceptsDineIn: true,
      acceptsServiceAtLocation: false,
      allowsPayLater: true,
      paymentUpiId: "audit@upi",
      paymentUpiName: audit.businessName,
      payoutMethod: "UPI",
      payoutUpiId: "audit@upi",
      payoutUpiName: audit.businessName,
      setupCompletedAt: now
    },
    create: {
      name: audit.businessName,
      slug: audit.businessSlug,
      ownerName: "Audit Owner",
      phone: "+15550100010",
      email: "audit.business@example.test",
      address: "Audit Local Street",
      city: "Audit City",
      state: "Audit State",
      logoUrl: null,
      businessType: "Tiffin Center",
      whatsappDisplayPhone: "+15550100010",
      whatsappConnected: false,
      whatsappLiveEnabled: false,
      subscriptionPlan: "PRO",
      subscriptionStatus: "ACTIVE",
      kycStatus: "APPROVED",
      kycSubmittedAt: now,
      kycReviewedAt: now,
      isVerified: true,
      isActive: true,
      isOpen: true,
      businessHours: "9:00 AM - 9:00 PM",
      minimumOrder: 0,
      deliveryFee: 0,
      serviceRadiusKm: 0,
      acceptsPickup: true,
      acceptsDineIn: true,
      acceptsServiceAtLocation: false,
      allowsPayLater: true,
      paymentUpiId: "audit@upi",
      paymentUpiName: audit.businessName,
      payoutMethod: "UPI",
      payoutUpiId: "audit@upi",
      payoutUpiName: audit.businessName,
      setupCompletedAt: now
    }
  });

  const [owner, admin, support] = await Promise.all([
    upsertAuditUser({
      email: audit.ownerEmail,
      name: "Audit Owner",
      phone: "+15550100011",
      role: "OWNER",
      businessId: business.id,
      passwordHash,
      verifiedAt: now
    }),
    upsertAuditUser({
      email: audit.adminEmail,
      name: "Audit Admin",
      phone: "+15550100012",
      role: "SUPER_ADMIN",
      businessId: null,
      passwordHash,
      verifiedAt: now
    }),
    upsertAuditUser({
      email: audit.supportEmail,
      name: "Audit Support",
      phone: "+15550100013",
      role: "SUPPORT_AGENT",
      businessId: null,
      passwordHash,
      verifiedAt: now
    })
  ]);

  const category = await prisma.menuCategory.upsert({
    where: {
      businessId_name: {
        businessId: business.id,
        name: "Audit Menu"
      }
    },
    update: { sortOrder: 10, ...seedProvenance },
    create: {
      businessId: business.id,
      name: "Audit Menu",
      sortOrder: 10,
      ...seedProvenance
    }
  });

  const menuItem = await upsertMenuItem({ businessId: business.id, categoryId: category.id });

  const customer = await prisma.customer.upsert({
    where: {
      businessId_phone: {
        businessId: business.id,
        phone: "+15550100020"
      }
    },
    update: {
      name: "Audit Customer",
      email: "audit.customer@example.test",
      address: "Audit Customer Address",
      whatsappOptIn: false,
      marketingOptIn: false,
      ...seedProvenance,
      totalOrders: 1,
      totalSpent: 180,
      lastOrderAt: now
    },
    create: {
      businessId: business.id,
      name: "Audit Customer",
      phone: "+15550100020",
      email: "audit.customer@example.test",
      address: "Audit Customer Address",
      whatsappOptIn: false,
      marketingOptIn: false,
      ...seedProvenance,
      totalOrders: 1,
      totalSpent: 180,
      lastOrderAt: now
    }
  });

  const order = await prisma.order.upsert({
    where: {
      businessId_orderNumber: {
        businessId: business.id,
        orderNumber: "AUDIT-1001"
      }
    },
    update: {
      customerId: customer.id,
      status: "DELIVERED",
      paymentStatus: "COMPLETED",
      ...seedProvenance,
      subtotal: 180,
      deliveryFee: 0,
      discountAmount: 0,
      taxableAmount: 180,
      gstRateBps: 0,
      gstAmount: 0,
      totalAmount: 180,
      orderType: "PICKUP",
      deliveryAddress: null,
      notes: "Local responsive audit order"
    },
    create: {
      businessId: business.id,
      customerId: customer.id,
      orderNumber: "AUDIT-1001",
      status: "DELIVERED",
      paymentStatus: "COMPLETED",
      ...seedProvenance,
      subtotal: 180,
      deliveryFee: 0,
      discountAmount: 0,
      taxableAmount: 180,
      gstRateBps: 0,
      gstAmount: 0,
      totalAmount: 180,
      orderType: "PICKUP",
      deliveryAddress: null,
      notes: "Local responsive audit order"
    }
  });

  await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
  await prisma.orderItem.create({
    data: {
      orderId: order.id,
      menuItemId: menuItem.id,
      itemName: menuItem.name,
      quantity: 1,
      price: 180,
      total: 180
    }
  });

  await prisma.payment.upsert({
    where: { orderId: order.id },
    update: {
      businessId: business.id,
      provider: "CASH",
      amount: 180,
      status: "COMPLETED",
      ...seedProvenance,
      paidAt: now
    },
    create: {
      businessId: business.id,
      orderId: order.id,
      provider: "CASH",
      amount: 180,
      status: "COMPLETED",
      ...seedProvenance,
      paidAt: now
    }
  });

  await upsertSubscription(business.id, now);

  const ticket = await prisma.supportTicket.upsert({
    where: { code: "AUDIT-SUPPORT-1001" },
    update: {
      subject: "Responsive audit support ticket",
      description: "Local-only fake ticket for responsive QA.",
      priority: "MEDIUM",
      status: "IN_REVIEW",
      source: "ADMIN",
      portal: "admin",
      businessId: business.id,
      requesterUserId: owner.id,
      assignedToUserId: support.id,
      requesterName: "Audit Customer",
      requesterEmail: "audit.customer@example.test",
      requesterPhone: "+15550100020",
      requesterBusinessName: audit.businessName,
      lastMessage: "Local-only responsive QA message.",
      safeHandlingNote: "Fake local audit data only.",
      lastMessageAt: now,
      assignedAt: now
    },
    create: {
      code: "AUDIT-SUPPORT-1001",
      subject: "Responsive audit support ticket",
      description: "Local-only fake ticket for responsive QA.",
      priority: "MEDIUM",
      status: "IN_REVIEW",
      source: "ADMIN",
      intent: "handoff",
      portal: "admin",
      businessId: business.id,
      requesterUserId: owner.id,
      assignedToUserId: support.id,
      requesterName: "Audit Customer",
      requesterEmail: "audit.customer@example.test",
      requesterPhone: "+15550100020",
      requesterBusinessName: audit.businessName,
      lastMessage: "Local-only responsive QA message.",
      safeHandlingNote: "Fake local audit data only.",
      lastMessageAt: now,
      assignedAt: now
    }
  });

  await prisma.supportTicketMessage.deleteMany({ where: { ticketId: ticket.id } });
  await prisma.supportTicketMessage.createMany({
    data: [
      {
        ticketId: ticket.id,
        sender: "CUSTOMER",
        body: "Local-only responsive QA message.",
        authorUserId: owner.id
      },
      {
        ticketId: ticket.id,
        sender: "AGENT",
        body: "Audit support agent response.",
        authorUserId: support.id
      }
    ]
  });

  console.log("Export these in the shell that will run scripts/qa/responsive-audit.mjs:");
  console.log(`export RESPONSIVE_OWNER_USER_ID=${owner.id}`);
  console.log(`export RESPONSIVE_OWNER_BUSINESS_ID=${business.id}`);
  console.log(`export RESPONSIVE_ADMIN_USER_ID=${admin.id}`);
  console.log(`export RESPONSIVE_SUPPORT_USER_ID=${support.id}`);
}

main()
  .then(async () => {
    await prisma?.$disconnect();
  })
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await prisma?.$disconnect();
    process.exit(1);
  });
