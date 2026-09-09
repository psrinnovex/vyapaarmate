import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const WRITE_CONFIRMATION = "CREATE_VYAPAARMATE_STORE_REVIEW_FIXTURES";
const PRODUCTION_CONFIRMATION = "PSHR_INNOVEX_APPROVES_SYNTHETIC_STORE_REVIEW_DATA";
const reviewIds = {
  business: "vm_store_review_business",
  owner: "vm_store_review_owner",
  customerUser: "vm_store_review_customer_user",
  deletionUser: "vm_store_review_deletion_user",
  staffUser: "vm_store_review_staff_user",
  customer: "vm_store_review_customer",
  deletionCustomer: "vm_store_review_deletion_customer",
  category: "vm_store_review_category",
  menuItem: "vm_store_review_menu_item",
  provider: "vm_store_review_provider",
  order: "vm_store_review_order",
  orderItem: "vm_store_review_order_item",
  appointment: "vm_store_review_appointment",
  payment: "vm_store_review_payment",
  subscription: "vm_store_review_subscription"
};

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function optional(name) {
  return process.env[name]?.trim() || null;
}

function email(name) {
  const value = required(name).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error(`${name} must be a valid dedicated review email address.`);
  }
  return value;
}

function phone(name) {
  const value = required(name);
  if (!/^\+[1-9]\d{7,14}$/.test(value)) {
    throw new Error(`${name} must be an E.164 phone number such as +919876543210.`);
  }
  return value;
}

function password(name) {
  const value = required(name);
  if (value.length < 16 || value.length > 128) {
    throw new Error(`${name} must contain 16-128 characters.`);
  }
  return value;
}

function targetGuard() {
  if (required("STORE_REVIEW_SEED_CONFIRM") !== WRITE_CONFIRMATION) {
    throw new Error(`STORE_REVIEW_SEED_CONFIRM must equal ${WRITE_CONFIRMATION}.`);
  }

  const target = required("STORE_REVIEW_TARGET").toLowerCase();
  if (!new Set(["local", "staging", "production"]).has(target)) {
    throw new Error("STORE_REVIEW_TARGET must be local, staging, or production.");
  }

  const databaseUrl = required("DATABASE_URL");
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error("DATABASE_URL must use postgresql:// or postgres://.");
  }

  const confirmedHost = required("STORE_REVIEW_CONFIRM_DATABASE_HOST").toLowerCase();
  if (parsed.hostname.toLowerCase() !== confirmedHost) {
    throw new Error(`STORE_REVIEW_CONFIRM_DATABASE_HOST does not match DATABASE_URL host ${parsed.hostname}.`);
  }

  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);
  if (target === "local" && !localHosts.has(parsed.hostname.toLowerCase())) {
    throw new Error("STORE_REVIEW_TARGET=local is allowed only for a local database host.");
  }
  if (target !== "local" && localHosts.has(parsed.hostname.toLowerCase())) {
    throw new Error(`STORE_REVIEW_TARGET=${target} cannot point to a local database host.`);
  }
  if (target === "production" && required("STORE_REVIEW_PRODUCTION_CONFIRM") !== PRODUCTION_CONFIRMATION) {
    throw new Error(`Production seeding also requires STORE_REVIEW_PRODUCTION_CONFIRM=${PRODUCTION_CONFIRMATION}.`);
  }
  if ((process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") && target !== "production") {
    throw new Error("A production process may seed only when STORE_REVIEW_TARGET=production and the production confirmation is present.");
  }

  return { target, databaseHost: parsed.hostname };
}

function credentialSet() {
  const credentials = {
    owner: {
      email: email("STORE_REVIEW_OWNER_EMAIL"),
      phone: phone("STORE_REVIEW_OWNER_PHONE"),
      password: password("STORE_REVIEW_OWNER_PASSWORD")
    },
    customer: {
      email: email("STORE_REVIEW_CUSTOMER_EMAIL"),
      phone: phone("STORE_REVIEW_CUSTOMER_PHONE"),
      password: password("STORE_REVIEW_CUSTOMER_PASSWORD")
    },
    deletion: {
      email: email("STORE_REVIEW_DELETION_EMAIL"),
      phone: phone("STORE_REVIEW_DELETION_PHONE"),
      password: password("STORE_REVIEW_DELETION_PASSWORD")
    }
  };

  const staffValues = {
    email: optional("STORE_REVIEW_STAFF_EMAIL"),
    phone: optional("STORE_REVIEW_STAFF_PHONE"),
    password: optional("STORE_REVIEW_STAFF_PASSWORD")
  };
  const suppliedStaffValues = Object.values(staffValues).filter(Boolean).length;
  if (suppliedStaffValues !== 0 && suppliedStaffValues !== 3) {
    throw new Error("Provide all or none of STORE_REVIEW_STAFF_EMAIL, STORE_REVIEW_STAFF_PHONE, and STORE_REVIEW_STAFF_PASSWORD.");
  }
  if (suppliedStaffValues === 3) {
    credentials.staff = {
      email: email("STORE_REVIEW_STAFF_EMAIL"),
      phone: phone("STORE_REVIEW_STAFF_PHONE"),
      password: password("STORE_REVIEW_STAFF_PASSWORD")
    };
  }

  const emails = Object.values(credentials).map((value) => value.email);
  const phones = Object.values(credentials).map((value) => value.phone);
  const passwords = Object.values(credentials).map((value) => value.password);
  if (new Set(emails).size !== emails.length) throw new Error("Every store-review account must use a different email address.");
  if (new Set(phones).size !== phones.length) throw new Error("Every store-review account must use a different phone number.");
  if (new Set(passwords).size !== passwords.length) throw new Error("Every store-review account must use a different password.");

  return credentials;
}

async function assertDedicatedTargets(tx, credentials) {
  const businessConflicts = await tx.business.findMany({
    where: {
      OR: [
        { id: reviewIds.business },
        { slug: "vyapaarmate-store-review" },
        { email: credentials.owner.email },
        { phone: credentials.owner.phone }
      ]
    },
    select: { id: true }
  });
  if (businessConflicts.some((business) => business.id !== reviewIds.business)) {
    throw new Error("The review business slug, email, or phone belongs to another business. No changes were made.");
  }

  const expectedUsers = [
    [reviewIds.owner, credentials.owner],
    [reviewIds.customerUser, credentials.customer],
    [reviewIds.deletionUser, credentials.deletion],
    ...(credentials.staff ? [[reviewIds.staffUser, credentials.staff]] : [])
  ];
  for (const [expectedId, values] of expectedUsers) {
    const conflicts = await tx.user.findMany({
      where: { OR: [{ id: expectedId }, { email: values.email }, { phone: values.phone }] },
      select: { id: true }
    });
    if (conflicts.some((user) => user.id !== expectedId)) {
      throw new Error(`A review email or phone belongs to another user. Conflicting fixture: ${expectedId}. No changes were made.`);
    }
  }

  const customerConflicts = await tx.customer.findMany({
    where: {
      OR: [
        { id: { in: [reviewIds.customer, reviewIds.deletionCustomer] } },
        {
          businessId: reviewIds.business,
          phone: { in: [credentials.customer.phone, credentials.deletion.phone] }
        }
      ]
    },
    select: { id: true, phone: true, businessId: true }
  });
  for (const customer of customerConflicts) {
    const expectedFixture = customer.id === reviewIds.customer || customer.id === reviewIds.deletionCustomer;
    const phoneAssignedToWrongFixture =
      (customer.phone === credentials.customer.phone && customer.id !== reviewIds.customer) ||
      (customer.phone === credentials.deletion.phone && customer.id !== reviewIds.deletionCustomer);
    if (!expectedFixture || customer.businessId !== reviewIds.business || phoneAssignedToWrongFixture) {
      throw new Error("A review customer phone belongs to another customer record. No changes were made.");
    }
  }

  const businessOwnedTargets = await Promise.all([
    tx.menuCategory.findUnique({ where: { id: reviewIds.category }, select: { businessId: true } }),
    tx.menuItem.findUnique({ where: { id: reviewIds.menuItem }, select: { businessId: true } }),
    tx.appointmentProvider.findUnique({ where: { id: reviewIds.provider }, select: { businessId: true } }),
    tx.order.findUnique({ where: { id: reviewIds.order }, select: { businessId: true } }),
    tx.appointment.findUnique({ where: { id: reviewIds.appointment }, select: { businessId: true } }),
    tx.payment.findUnique({ where: { id: reviewIds.payment }, select: { businessId: true } }),
    tx.subscription.findUnique({ where: { id: reviewIds.subscription }, select: { businessId: true } })
  ]);
  if (businessOwnedTargets.some((target) => target && target.businessId !== reviewIds.business)) {
    throw new Error("A deterministic store-review fixture ID is already owned by another business. No changes were made.");
  }

  const existingOrderItem = await tx.orderItem.findUnique({
    where: { id: reviewIds.orderItem },
    select: { orderId: true }
  });
  if (existingOrderItem && existingOrderItem.orderId !== reviewIds.order) {
    throw new Error("The deterministic store-review order-item ID is already in use. No changes were made.");
  }
}

function businessData(credentials, serviceTypeId, now) {
  return {
    name: "VyapaarMate Store Review Studio",
    slug: "vyapaarmate-store-review",
    ownerName: "Store Review Owner",
    phone: credentials.owner.phone,
    email: credentials.owner.email,
    address: "Synthetic store-review location",
    city: "Bengaluru",
    state: "Karnataka",
    logoUrl: null,
    businessType: "Salon and Spa",
    businessServiceTypeId: serviceTypeId,
    whatsappDisplayPhone: null,
    whatsappPhoneNumberId: null,
    whatsappWabaId: null,
    whatsappAccessTokenEnc: null,
    whatsappConnected: false,
    whatsappLiveEnabled: false,
    whatsappApprovedAt: null,
    subscriptionPlan: "PRO",
    subscriptionStatus: "ACTIVE",
    kycStatus: "APPROVED",
    kycSubmittedAt: null,
    kycReviewedAt: null,
    kycReviewedByUserId: null,
    kycRejectionReason: null,
    isVerified: true,
    isActive: true,
    isOpen: true,
    businessHours: "Store review fixture - no walk-ins",
    minimumOrder: 0,
    deliveryFee: 0,
    latitude: null,
    longitude: null,
    serviceRadiusKm: 0,
    acceptsPickup: false,
    acceptsDineIn: true,
    acceptsServiceAtLocation: false,
    allowsPayLater: true,
    appointmentBookingEnabled: true,
    appointmentAutoConfirm: true,
    appointmentTimezone: "Asia/Kolkata",
    appointmentSlotInterval: 15,
    appointmentLeadTimeMinutes: 60,
    appointmentMaxAdvanceDays: 60,
    appointmentCancelNoticeMins: 120,
    paymentUpiId: null,
    paymentUpiName: null,
    payoutMethod: "UPI",
    payoutUpiId: null,
    payoutUpiName: null,
    payoutAccountHolderName: null,
    payoutBankName: null,
    payoutBankAccountNumber: null,
    payoutBankIfsc: null,
    cashfreePayoutBeneficiaryId: null,
    setupCompletedAt: now,
    razorpayLinkedAccountId: null,
    razorpayRouteEnabled: false,
    cashfreeVendorId: null,
    cashfreeSplitEnabled: false,
    platformFeeBps: 0
  };
}

async function upsertReviewUser(tx, { id, name, role, businessId, credentials, passwordHash, verifiedAt }) {
  const data = {
    name,
    email: credentials.email,
    phone: credentials.phone,
    passwordHash,
    role,
    businessId,
    emailVerifiedAt: verifiedAt,
    phoneVerifiedAt: verifiedAt
  };
  return tx.user.upsert({ where: { id }, create: { id, ...data }, update: data });
}

async function main() {
  const target = targetGuard();
  const credentials = credentialSet();
  const passwordEntries = await Promise.all(
    Object.entries(credentials).map(async ([key, values]) => [key, await bcrypt.hash(values.password, 12)])
  );
  const passwordHashes = Object.fromEntries(passwordEntries);
  const now = new Date();
  const startsAt = new Date(now.getTime() + 3 * 24 * 60 * 60_000);
  startsAt.setUTCHours(6, 30, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 45 * 60_000);
  const subscriptionEnd = new Date(now.getTime() + 365 * 24 * 60 * 60_000);

  await prisma.$transaction(async (tx) => {
    await assertDedicatedTargets(tx, credentials);

    let serviceType = await tx.businessServiceType.findUnique({ where: { slug: "salon-spa" } });
    if (!serviceType) {
      serviceType = await tx.businessServiceType.create({
        data: {
          id: "bst_salon_spa",
          slug: "salon-spa",
          name: "Salon and Spa",
          description: "Beauty salons, grooming studios, and spa services.",
          sortOrder: 100,
          isActive: true
        }
      });
    }

    const currentBusinessData = businessData(credentials, serviceType.id, now);
    await tx.business.upsert({
      where: { id: reviewIds.business },
      create: { id: reviewIds.business, ...currentBusinessData },
      update: currentBusinessData
    });

    const owner = await upsertReviewUser(tx, {
      id: reviewIds.owner,
      name: "Store Review Owner",
      role: "OWNER",
      businessId: reviewIds.business,
      credentials: credentials.owner,
      passwordHash: passwordHashes.owner,
      verifiedAt: now
    });
    await upsertReviewUser(tx, {
      id: reviewIds.customerUser,
      name: "Store Review Customer",
      role: "CUSTOMER",
      businessId: null,
      credentials: credentials.customer,
      passwordHash: passwordHashes.customer,
      verifiedAt: now
    });
    await upsertReviewUser(tx, {
      id: reviewIds.deletionUser,
      name: "Deletion Test Customer",
      role: "CUSTOMER",
      businessId: null,
      credentials: credentials.deletion,
      passwordHash: passwordHashes.deletion,
      verifiedAt: now
    });
    if (credentials.staff) {
      await upsertReviewUser(tx, {
        id: reviewIds.staffUser,
        name: "Store Review Manager",
        role: "MANAGER",
        businessId: reviewIds.business,
        credentials: credentials.staff,
        passwordHash: passwordHashes.staff,
        verifiedAt: now
      });
    }

    await tx.customer.upsert({
      where: { id: reviewIds.customer },
      create: {
        id: reviewIds.customer,
        businessId: reviewIds.business,
        name: "Store Review Customer",
        phone: credentials.customer.phone,
        email: credentials.customer.email,
        address: "Synthetic customer address",
        whatsappOptIn: false,
        marketingOptIn: false,
        dataOrigin: "TEST",
        trainingEligible: false,
        totalOrders: 1,
        totalSpent: 0,
        lastOrderAt: now
      },
      update: {
        name: "Store Review Customer",
        phone: credentials.customer.phone,
        email: credentials.customer.email,
        address: "Synthetic customer address",
        whatsappOptIn: false,
        marketingOptIn: false,
        dataOrigin: "TEST",
        trainingEligible: false,
        totalOrders: 1,
        totalSpent: 0,
        lastOrderAt: now
      }
    });
    await tx.customer.upsert({
      where: { id: reviewIds.deletionCustomer },
      create: {
        id: reviewIds.deletionCustomer,
        businessId: reviewIds.business,
        name: "Deletion Test Customer",
        phone: credentials.deletion.phone,
        email: credentials.deletion.email,
        address: "Synthetic deletion-test address",
        whatsappOptIn: false,
        marketingOptIn: false,
        dataOrigin: "TEST",
        trainingEligible: false
      },
      update: {
        name: "Deletion Test Customer",
        phone: credentials.deletion.phone,
        email: credentials.deletion.email,
        address: "Synthetic deletion-test address",
        whatsappOptIn: false,
        marketingOptIn: false,
        dataOrigin: "TEST",
        trainingEligible: false
      }
    });

    await tx.menuCategory.upsert({
      where: { id: reviewIds.category },
      create: {
        id: reviewIds.category,
        businessId: reviewIds.business,
        name: "Store Review Services",
        sortOrder: 10,
        dataOrigin: "TEST",
        trainingEligible: false
      },
      update: { name: "Store Review Services", sortOrder: 10, dataOrigin: "TEST", trainingEligible: false }
    });
    await tx.menuItem.upsert({
      where: { id: reviewIds.menuItem },
      create: {
        id: reviewIds.menuItem,
        businessId: reviewIds.business,
        categoryId: reviewIds.category,
        name: "In-person review appointment",
        description: "Synthetic, in-person service used only for app-store review. No real fulfilment or payment.",
        price: 499,
        foodType: "NOT_APPLICABLE",
        isAvailable: true,
        isBestSeller: true,
        dataOrigin: "TEST",
        trainingEligible: false,
        appointmentEnabled: true,
        durationMinutes: 45,
        bufferMinutes: 0
      },
      update: {
        categoryId: reviewIds.category,
        name: "In-person review appointment",
        description: "Synthetic, in-person service used only for app-store review. No real fulfilment or payment.",
        price: 499,
        foodType: "NOT_APPLICABLE",
        isAvailable: true,
        isBestSeller: true,
        dataOrigin: "TEST",
        trainingEligible: false,
        appointmentEnabled: true,
        durationMinutes: 45,
        bufferMinutes: 0
      }
    });

    await tx.appointmentProvider.upsert({
      where: { id: reviewIds.provider },
      create: {
        id: reviewIds.provider,
        businessId: reviewIds.business,
        userId: owner.id,
        name: "Review Provider",
        title: "Synthetic service provider",
        bio: "Store-review fixture only.",
        isActive: true,
        acceptsAtBusiness: true,
        acceptsAtCustomerLocation: false
      },
      update: {
        userId: owner.id,
        name: "Review Provider",
        title: "Synthetic service provider",
        bio: "Store-review fixture only.",
        isActive: true,
        acceptsAtBusiness: true,
        acceptsAtCustomerLocation: false
      }
    });
    await tx.appointmentProviderService.upsert({
      where: { providerId_menuItemId: { providerId: reviewIds.provider, menuItemId: reviewIds.menuItem } },
      create: { providerId: reviewIds.provider, menuItemId: reviewIds.menuItem, durationOverrideMinutes: 45, bufferOverrideMinutes: 0 },
      update: { durationOverrideMinutes: 45, bufferOverrideMinutes: 0 }
    });

    await tx.order.upsert({
      where: { id: reviewIds.order },
      create: {
        id: reviewIds.order,
        businessId: reviewIds.business,
        customerId: reviewIds.customer,
        orderNumber: "STORE-REVIEW-1001",
        status: "ACCEPTED",
        paymentStatus: "PENDING",
        subtotal: 499,
        taxableAmount: 499,
        gstRateBps: 0,
        gstAmount: 0,
        totalAmount: 499,
        orderType: "DINE_IN",
        notes: "Synthetic store-review appointment. Do not fulfil or send live notifications.",
        scheduledFor: startsAt,
        dataOrigin: "TEST",
        trainingEligible: false
      },
      update: {
        customerId: reviewIds.customer,
        status: "ACCEPTED",
        paymentStatus: "PENDING",
        subtotal: 499,
        deliveryFee: 0,
        discountAmount: 0,
        taxableAmount: 499,
        gstRateBps: 0,
        gstAmount: 0,
        totalAmount: 499,
        orderType: "DINE_IN",
        deliveryAddress: null,
        customerLatitude: null,
        customerLongitude: null,
        distanceKm: null,
        notes: "Synthetic store-review appointment. Do not fulfil or send live notifications.",
        scheduledFor: startsAt,
        completedAt: null,
        cancelledAt: null,
        cancellationReason: null,
        noShowAt: null,
        dataOrigin: "TEST",
        trainingEligible: false
      }
    });
    await tx.orderItem.upsert({
      where: { id: reviewIds.orderItem },
      create: {
        id: reviewIds.orderItem,
        orderId: reviewIds.order,
        menuItemId: reviewIds.menuItem,
        itemName: "In-person review appointment",
        quantity: 1,
        price: 499,
        total: 499
      },
      update: {
        orderId: reviewIds.order,
        menuItemId: reviewIds.menuItem,
        itemName: "In-person review appointment",
        quantity: 1,
        price: 499,
        total: 499
      }
    });
    await tx.appointment.upsert({
      where: { id: reviewIds.appointment },
      create: {
        id: reviewIds.appointment,
        businessId: reviewIds.business,
        orderId: reviewIds.order,
        customerId: reviewIds.customer,
        providerId: reviewIds.provider,
        startsAt,
        endsAt,
        blockedUntil: endsAt,
        timezone: "Asia/Kolkata",
        status: "CONFIRMED",
        source: "DASHBOARD",
        autoConfirmed: true,
        confirmedAt: now
      },
      update: {
        customerId: reviewIds.customer,
        providerId: reviewIds.provider,
        startsAt,
        endsAt,
        blockedUntil: endsAt,
        timezone: "Asia/Kolkata",
        status: "CONFIRMED",
        source: "DASHBOARD",
        autoConfirmed: true,
        confirmedAt: now,
        cancelledAt: null,
        completedAt: null,
        cancellationReason: null
      }
    });
    await tx.payment.upsert({
      where: { id: reviewIds.payment },
      create: {
        id: reviewIds.payment,
        businessId: reviewIds.business,
        orderId: reviewIds.order,
        provider: "CASH",
        amount: 499,
        status: "PENDING",
        dataOrigin: "TEST",
        trainingEligible: false
      },
      update: {
        provider: "CASH",
        razorpayPaymentLinkId: null,
        razorpayPaymentId: null,
        razorpayTransferId: null,
        cashfreeOrderId: null,
        cashfreeCfOrderId: null,
        cashfreePaymentSessionId: null,
        cashfreePaymentId: null,
        cashfreeOrderStatus: null,
        manualVerificationReference: null,
        paymentRequestUrl: null,
        paymentRequestExpiresAt: null,
        amount: 499,
        status: "PENDING",
        paidAt: null,
        dataOrigin: "TEST",
        trainingEligible: false
      }
    });

    await tx.subscription.upsert({
      where: { id: reviewIds.subscription },
      create: {
        id: reviewIds.subscription,
        businessId: reviewIds.business,
        plan: "PRO",
        subtotalAmount: 0,
        taxableAmount: 0,
        gstRateBps: 0,
        gstAmount: 0,
        amount: 0,
        status: "ACTIVE",
        paymentStatus: "COMPLETED",
        paymentProvider: "CASH",
        startDate: now,
        endDate: subscriptionEnd
      },
      update: {
        plan: "PRO",
        subtotalAmount: 0,
        discountAmount: 0,
        upgradeCreditAmount: 0,
        taxableAmount: 0,
        gstRateBps: 0,
        gstAmount: 0,
        billingGstin: null,
        billingBusinessSnapshot: null,
        couponCode: null,
        subscriptionCouponId: null,
        amount: 0,
        status: "ACTIVE",
        paymentStatus: "COMPLETED",
        paymentProvider: "CASH",
        razorpayPaymentLinkId: null,
        razorpayPaymentId: null,
        cashfreeOrderId: null,
        cashfreeCfOrderId: null,
        cashfreePaymentSessionId: null,
        cashfreePaymentId: null,
        cashfreeOrderStatus: null,
        manualVerificationReference: null,
        paymentRequestUrl: null,
        paymentRequestExpiresAt: null,
        paidAt: null,
        startDate: now,
        endDate: subscriptionEnd
      }
    });

    const auditExists = await tx.auditLog.findFirst({
      where: { action: "STORE_REVIEW_FIXTURE_CREATED", entity: "Business", entityId: reviewIds.business },
      select: { id: true }
    });
    if (!auditExists) {
      await tx.auditLog.create({
        data: {
          businessId: reviewIds.business,
          action: "STORE_REVIEW_FIXTURE_CREATED",
          entity: "Business",
          entityId: reviewIds.business,
          metadata: {
            source: "scripts/seed-store-review.mjs",
            dataOrigin: "TEST",
            trainingEligible: false,
            target: target.target,
            realMoney: false,
            liveMessaging: false,
            kycDocuments: false
          }
        }
      });
    }
  }, { maxWait: 10_000, timeout: 45_000 });

  console.log("VyapaarMate store-review fixtures are ready.");
  console.log(`Target: ${target.target} (${target.databaseHost})`);
  console.log(`Business ID: ${reviewIds.business}`);
  console.log(`Business slug: vyapaarmate-store-review`);
  console.log(`Customer deletion fixture ID: ${reviewIds.deletionUser}`);
  if (credentials.staff) console.log(`Staff fixture ID: ${reviewIds.staffUser}`);
  console.log("No password, token, payment credential, bank detail, or KYC document was printed or stored by this script.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
