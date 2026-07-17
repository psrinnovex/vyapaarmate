import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { businessServiceTypeOptions } from "../lib/business-service-types";
import { subscriptionPlanAmounts } from "../lib/billing";

const prisma = new PrismaClient();
const seedProvenance = { dataOrigin: "SEED" as const, trainingEligible: false };

function demoSeedPassword() {
  const password = process.env.DEMO_SEED_PASSWORD?.trim();
  if (!password || password.length < 10) {
    throw new Error(
      "DEMO_SEED_PASSWORD must be set to a unique local-only password with at least 10 characters before seeding."
    );
  }

  return password;
}

async function main() {
  const passwordHash = await bcrypt.hash(demoSeedPassword(), 12);

  console.warn(
    "Demo accounts are for local development only. Never reuse DEMO_SEED_PASSWORD for production accounts."
  );

  await prisma.auditLog.deleteMany();
  await prisma.supportTicketMessage.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.whatsappMessage.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.menuCategory.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.user.deleteMany();
  await prisma.business.deleteMany();
  await prisma.businessServiceType.deleteMany();

  await prisma.businessServiceType.createMany({
    data: businessServiceTypeOptions.map((serviceType, index) => ({
      ...serviceType,
      sortOrder: (index + 1) * 10
    }))
  });

  const businesses = await Promise.all([
    prisma.business.create({
      data: {
        id: "biz_1",
        name: "Sri Sai Tiffins",
        slug: "sri-sai-tiffins",
        ownerName: "Srinivas Rao",
        phone: "+919876543210",
        whatsappDisplayPhone: "+919876543210",
        whatsappPhoneNumberId: "demo_phone_number_sri_sai",
        whatsappWabaId: "demo_waba_sri_sai",
        whatsappConnected: true,
        whatsappLiveEnabled: false,
        email: "orders@srisaitiffins.in",
        address: "12 MG Road, Vijayawada",
        city: "Vijayawada",
        state: "Andhra Pradesh",
        logoUrl: "/demo/sri-sai.svg",
        businessType: "Tiffin Center",
        businessServiceTypeId: "bst_tiffin_center",
        subscriptionPlan: "PRO",
        subscriptionStatus: "ACTIVE",
        kycStatus: "APPROVED",
        kycSubmittedAt: new Date(),
        kycReviewedAt: new Date(),
        isVerified: true,
        isOpen: true,
        businessHours: "7:00 AM - 10:30 PM",
        minimumOrder: 99,
        deliveryFee: 0,
        latitude: 16.5062,
        longitude: 80.6480,
        serviceRadiusKm: 0,
        acceptsPickup: true,
        acceptsDineIn: true,
        acceptsServiceAtLocation: false,
        allowsPayLater: true
      }
    }),
    prisma.business.create({
      data: {
        id: "biz_2",
        name: "Fresh Bowl Cloud Kitchen",
        slug: "fresh-bowl-cloud-kitchen",
        ownerName: "Ananya Sharma",
        phone: "+919812340987",
        whatsappDisplayPhone: "+919812340987",
        whatsappPhoneNumberId: "demo_phone_number_fresh_bowl",
        whatsappWabaId: "demo_waba_fresh_bowl",
        whatsappConnected: true,
        whatsappLiveEnabled: false,
        email: "hello@freshbowl.in",
        address: "HSR Layout, Bengaluru",
        city: "Bengaluru",
        state: "Karnataka",
        logoUrl: "/demo/fresh-bowl.svg",
        businessType: "Cloud Kitchen",
        businessServiceTypeId: "bst_cloud_kitchen",
        subscriptionPlan: "PRO",
        subscriptionStatus: "ACTIVE",
        kycStatus: "APPROVED",
        kycSubmittedAt: new Date(),
        kycReviewedAt: new Date(),
        isVerified: true,
        isOpen: true,
        businessHours: "11:00 AM - 11:00 PM",
        minimumOrder: 199,
        deliveryFee: 0,
        latitude: 12.9116,
        longitude: 77.6389,
        serviceRadiusKm: 0,
        acceptsPickup: true,
        acceptsDineIn: false,
        acceptsServiceAtLocation: false,
        allowsPayLater: false
      }
    }),
    prisma.business.create({
      data: {
        id: "biz_3",
        name: "Sweet Cravings Home Bakery",
        slug: "sweet-cravings-home-bakery",
        ownerName: "Meera Kapoor",
        phone: "+919900112233",
        whatsappDisplayPhone: "+919900112233",
        whatsappPhoneNumberId: "demo_phone_number_bakery",
        whatsappWabaId: "demo_waba_bakery",
        whatsappConnected: false,
        whatsappLiveEnabled: false,
        email: "cakes@sweetcravings.in",
        address: "Sector 45, Gurugram",
        city: "Gurugram",
        state: "Haryana",
        logoUrl: "/demo/sweet-cravings.svg",
        businessType: "Home Bakery",
        businessServiceTypeId: "bst_home_bakery",
        subscriptionPlan: "STARTER",
        subscriptionStatus: "PAST_DUE",
        kycStatus: "PAYMENT_PENDING",
        isVerified: false,
        isActive: false,
        isOpen: false,
        businessHours: "10:00 AM - 8:00 PM",
        minimumOrder: 299,
        deliveryFee: 0,
        latitude: 28.4517,
        longitude: 77.0700,
        serviceRadiusKm: 0,
        acceptsPickup: true,
        acceptsDineIn: false,
        acceptsServiceAtLocation: false,
        allowsPayLater: true
      }
    })
  ]);

  const [tiffins, freshBowl, bakery] = businesses;
  const fixtureVerifiedAt = new Date();

  await prisma.user.createMany({
    data: [
      {
        name: "PSHR Admin",
        email: "admin@pshrinnovex.com",
        phone: "+919999999999",
        passwordHash,
        role: "SUPER_ADMIN",
        emailVerifiedAt: fixtureVerifiedAt,
        phoneVerifiedAt: fixtureVerifiedAt
      },
      {
        name: "Demo Support Agent",
        email: "support@demo.com",
        phone: "+919999999998",
        passwordHash,
        role: "SUPPORT_AGENT",
        emailVerifiedAt: fixtureVerifiedAt,
        phoneVerifiedAt: fixtureVerifiedAt
      },
      {
        name: "Demo Owner",
        email: "owner@demo.com",
        phone: "+918888888888",
        passwordHash,
        role: "OWNER",
        businessId: tiffins.id,
        emailVerifiedAt: fixtureVerifiedAt,
        phoneVerifiedAt: fixtureVerifiedAt
      },
      {
        name: "Kitchen Lead",
        email: "kitchen@demo.com",
        phone: "+918888888889",
        passwordHash,
        role: "KITCHEN_STAFF",
        businessId: tiffins.id,
        emailVerifiedAt: fixtureVerifiedAt,
        phoneVerifiedAt: fixtureVerifiedAt
      }
    ]
  });

  const breakfast = await prisma.menuCategory.create({
    data: { id: "cat_breakfast", businessId: tiffins.id, name: "Breakfast", sortOrder: 1, ...seedProvenance }
  });
  const meals = await prisma.menuCategory.create({
    data: { id: "cat_meals", businessId: tiffins.id, name: "Meals", sortOrder: 2, ...seedProvenance }
  });
  const bowls = await prisma.menuCategory.create({
    data: { id: "cat_bowls", businessId: freshBowl.id, name: "Signature Bowls", sortOrder: 1, ...seedProvenance }
  });
  const cakes = await prisma.menuCategory.create({
    data: { id: "cat_cakes", businessId: bakery.id, name: "Cakes", sortOrder: 1, ...seedProvenance }
  });

  const items = await prisma.$transaction([
    prisma.menuItem.create({
      data: {
        id: "item_1",
        businessId: tiffins.id,
        categoryId: breakfast.id,
        name: "Ghee Idli Combo",
        description: "Three soft idlis with ghee, podi, sambar, and coconut chutney.",
        price: 89,
        foodType: "VEG",
        isBestSeller: true,
        ...seedProvenance
      }
    }),
    prisma.menuItem.create({
      data: {
        id: "item_2",
        businessId: tiffins.id,
        categoryId: breakfast.id,
        name: "Masala Dosa",
        description: "Crisp dosa with potato masala and three chutneys.",
        price: 119,
        foodType: "VEG",
        isBestSeller: true,
        ...seedProvenance
      }
    }),
    prisma.menuItem.create({
      data: {
        id: "item_3",
        businessId: tiffins.id,
        categoryId: meals.id,
        name: "Mini Meals",
        description: "Rice, dal, curry, curd, papad, and pickle.",
        price: 149,
        foodType: "VEG",
        ...seedProvenance
      }
    }),
    prisma.menuItem.create({
      data: {
        id: "item_4",
        businessId: tiffins.id,
        categoryId: breakfast.id,
        name: "Punugulu Plate",
        description: "Crispy evening snack with ginger chutney.",
        price: 79,
        foodType: "VEG",
        ...seedProvenance
      }
    }),
    prisma.menuItem.create({
      data: {
        id: "item_5",
        businessId: freshBowl.id,
        categoryId: bowls.id,
        name: "Paneer Protein Bowl",
        description: "Paneer tikka, millet rice, salad, mint dressing.",
        price: 249,
        foodType: "VEG",
        isBestSeller: true,
        ...seedProvenance
      }
    }),
    prisma.menuItem.create({
      data: {
        id: "item_6",
        businessId: freshBowl.id,
        categoryId: bowls.id,
        name: "Chicken Teriyaki Bowl",
        description: "Grilled chicken, herbed rice, greens, teriyaki sauce.",
        price: 289,
        foodType: "NON_VEG",
        ...seedProvenance
      }
    }),
    prisma.menuItem.create({
      data: {
        id: "item_7",
        businessId: bakery.id,
        categoryId: cakes.id,
        name: "Belgian Chocolate Bento Cake",
        description: "Small-batch chocolate cake with ganache frosting.",
        price: 399,
        foodType: "EGG",
        isBestSeller: true,
        ...seedProvenance
      }
    }),
    prisma.menuItem.create({
      data: {
        id: "item_8",
        businessId: bakery.id,
        categoryId: cakes.id,
        name: "Assorted Cupcake Box",
        description: "Six cupcakes with chocolate, vanilla, and strawberry frosting.",
        price: 549,
        foodType: "EGG",
        ...seedProvenance
      }
    })
  ]);

  const customer = await prisma.customer.create({
    data: {
      id: "cust_rahul",
      businessId: tiffins.id,
      name: "Rahul Verma",
      phone: "+919700001111",
      address: "Flat 304, Lakshmi Residency",
      whatsappOptIn: true,
      marketingOptIn: true,
      ...seedProvenance,
      totalOrders: 8,
      totalSpent: 2840,
      lastOrderAt: new Date()
    }
  });

  const order = await prisma.order.create({
    data: {
      businessId: tiffins.id,
      customerId: customer.id,
      orderNumber: "VM-1001",
      status: "PREPARING",
      paymentStatus: "COMPLETED",
      ...seedProvenance,
      subtotal: 238,
      deliveryFee: 0,
      taxableAmount: 238,
      gstRateBps: 0,
      gstAmount: 0,
      totalAmount: 238,
      orderType: "PICKUP",
      deliveryAddress: null,
      notes: "Extra chutney please",
      items: {
        create: [
          {
            menuItemId: items[0].id,
            itemName: "Ghee Idli Combo",
            quantity: 1,
            price: 89,
            total: 89
          },
          {
            menuItemId: items[1].id,
            itemName: "Masala Dosa",
            quantity: 1,
            price: 119,
            total: 119
          }
        ]
      }
    }
  });

  await prisma.payment.create({
    data: {
      businessId: tiffins.id,
      orderId: order.id,
      provider: "CASHFREE",
      cashfreeOrderId: "cf_demo_order_1001",
      cashfreeCfOrderId: "cf_demo_1001",
      cashfreePaymentId: "cfpay_demo_1001",
      cashfreeOrderStatus: "PAID",
      amount: 238,
      status: "COMPLETED",
      ...seedProvenance
    }
  });

  await prisma.whatsappMessage.create({
    data: {
      businessId: tiffins.id,
      customerId: customer.id,
      orderId: order.id,
      templateName: "order_preparing_update",
      phone: customer.phone,
      status: "SENT",
      sentAt: new Date()
    }
  });

  await prisma.subscription.createMany({
    data: businesses.map((business) => ({
      businessId: business.id,
      plan: business.subscriptionPlan,
      amount: subscriptionPlanAmounts[business.subscriptionPlan],
      status: business.subscriptionStatus,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }))
  });

  await prisma.auditLog.create({
    data: {
      businessId: tiffins.id,
      action: "DEMO_SEED_CREATED",
      entity: "Business",
      entityId: tiffins.id,
      metadata: { source: "prisma/seed.ts" }
    }
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
