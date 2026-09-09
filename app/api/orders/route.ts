import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getMobileRequestSession, getSessionUser, isMobileBearerRequest } from "@/lib/api-session";
import { AppointmentAvailabilityError, prepareAppointmentReservation } from "@/lib/appointment-data";
import { businessTypeSupportsAppointments } from "@/lib/appointment-scheduling";
import {
  calculateDistanceKm,
  fulfillmentFeeForOrder,
  fulfillmentLabelForBusinessType,
  fulfillmentModesFromFlags,
  isValidCoordinate,
  requiresScheduledServiceTime
} from "@/lib/business-rules";
import { isBusinessAcceptingNow } from "@/lib/business-hours";
import { getBusinessConsoleCopy } from "@/lib/business-console-copy";
import { normalizeCouponCode } from "@/lib/billing";
import { buildOrderCouponBreakdown, validateBusinessCoupon } from "@/lib/coupons";
import { writeAuditLog } from "@/lib/audit";
import { isEligibleLaunchBusinessLocation, launchMarket } from "@/lib/launch-policy";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { parseJsonRequest } from "@/lib/security/validation";
import { currentPaidSubscriptionWhere } from "@/lib/subscription-access";
import { orderSubmissionSchema } from "@/lib/validations";
import { classifyMobileExternalPayment } from "@/lib/mobile-commerce-policy";
import {
  isValidMobileOrderIdempotencyKey,
  mobileOrderBodyHash,
  mobileOrderKeyHash
} from "@/lib/mobile-order-idempotency";
import { formatINR } from "@/lib/utils";
import { businessWhatsappConfig } from "@/services/business-whatsapp";
import { canBusinessAcceptOnlinePayment, createCustomerPaymentRequest, getOnlinePaymentConfig, onlinePaymentProviderLabel, selectedOnlinePaymentProvider } from "@/services/online-payments";
import { smsVerificationEnabled } from "@/services/sms";
import { sendWhatsAppTemplate } from "@/services/whatsapp";

function createOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `VM-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function publicAppUrl(request: Request) {
  return (process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin).replace(/\/$/, "");
}

const mobileReplayOrderSelect = {
  id: true,
  publicToken: true,
  orderNumber: true,
  status: true,
  totalAmount: true,
  mobileRequestBodyHash: true,
  appointment: {
    select: {
      startsAt: true,
      endsAt: true,
      status: true,
      provider: { select: { name: true, title: true } }
    }
  }
} satisfies Prisma.OrderSelect;

type MobileReplayOrder = Prisma.OrderGetPayload<{ select: typeof mobileReplayOrderSelect }>;

function mobileOrderReplayResponse(request: Request, order: MobileReplayOrder) {
  const orderUrl = `${publicAppUrl(request)}/order/${order.publicToken}`;
  return NextResponse.json(
    {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      paymentUrl: null,
      paymentReady: true,
      paymentSetupError: null,
      orderUrl,
      invoiceUrl: `${orderUrl}#invoice`,
      appointment: order.appointment
        ? {
            startsAt: order.appointment.startsAt.toISOString(),
            endsAt: order.appointment.endsAt.toISOString(),
            status: order.appointment.status,
            providerName: order.appointment.provider.name,
            providerTitle: order.appointment.provider.title
          }
        : null,
      idempotentReplay: true,
      message: `Order ${order.orderNumber} was already received. This retry did not create another order.`
    },
    { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } }
  );
}

type VerifiedCustomerProfile = {
  id: string;
  name: string;
  email: string;
  phone: string;
};

async function getVerifiedCustomerProfile(input: {
  submittedEmail?: string;
  submittedPhone: string;
  businessSlug: string;
}) {
  const session = await getSessionUser();
  const loginHref = `/login?type=user&next=${encodeURIComponent(`/b/${input.businessSlug}`)}`;

  if (!session) {
    return {
      response: NextResponse.json(
        {
          error: "Sign in with a verified user profile before placing a request.",
          code: "CUSTOMER_LOGIN_REQUIRED",
          loginHref
        },
        { status: 401 }
      )
    };
  }

  if (session.role !== "CUSTOMER") {
    return {
      response: NextResponse.json(
        {
          error: "Use a verified customer account before placing a request.",
          code: "CUSTOMER_ACCOUNT_REQUIRED"
        },
        { status: 403 }
      )
    };
  }

  const user = await prisma.user.findFirst({
    where: { id: session.id, role: "CUSTOMER" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true
    }
  });

  if (!user) {
    return {
      response: NextResponse.json(
        {
          error: "Sign in with a verified user profile before placing a request.",
          code: "CUSTOMER_LOGIN_REQUIRED",
          loginHref
        },
        { status: 401 }
      )
    };
  }

  if (!user.emailVerifiedAt || (smsVerificationEnabled() && !user.phoneVerifiedAt)) {
    return {
      response: NextResponse.json(
        {
          error: "Your user profile must be verified before placing a request.",
          code: "CUSTOMER_PROFILE_VERIFICATION_REQUIRED"
        },
        { status: 403 }
      )
    };
  }

  if (!user.phone) {
    return {
      response: NextResponse.json(
        {
          error: "Add a verified phone number to your user profile before placing a request.",
          code: "CUSTOMER_PROFILE_PHONE_REQUIRED"
        },
        { status: 403 }
      )
    };
  }

  if (input.submittedEmail && input.submittedEmail.toLowerCase() !== user.email.toLowerCase()) {
    return {
      response: NextResponse.json(
        {
          error: "Use the email from your verified user profile to continue.",
          code: "CUSTOMER_PROFILE_EMAIL_MISMATCH"
        },
        { status: 400 }
      )
    };
  }

  if (input.submittedPhone !== user.phone) {
    return {
      response: NextResponse.json(
        {
          error: "Use the phone number from your verified user profile to continue.",
          code: "CUSTOMER_PROFILE_PHONE_MISMATCH"
        },
        { status: 400 }
      )
    };
  }

  return {
    profile: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone
    } satisfies VerifiedCustomerProfile
  };
}

export async function POST(request: Request) {
  let mobileOrderContext: { keyHash: string; bodyHash: string } | null = null;
  if (await isMobileBearerRequest()) {
    const mobile = await getMobileRequestSession();
    if (!mobile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    if (mobile.user.role !== "CUSTOMER") {
      return NextResponse.json({ error: "Customer account required" }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
    const idempotencyKey = request.headers.get("idempotency-key");
    if (!isValidMobileOrderIdempotencyKey(idempotencyKey)) {
      return NextResponse.json(
        { error: "Provide a unique Idempotency-Key containing 16-128 safe characters.", code: "MOBILE_IDEMPOTENCY_KEY_REQUIRED" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    const mobileInput = orderSubmissionSchema.safeParse(await request.clone().json().catch(() => null));
    if (!mobileInput.success) {
      return NextResponse.json({ error: "Invalid order request." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    const mobileBusiness = await prisma.business.findUnique({
      where: { slug: mobileInput.data.businessSlug },
      select: {
        businessServiceType: { select: { slug: true } },
        menuItems: {
          where: { id: { in: mobileInput.data.items.map((item) => item.menuItemId) } },
          select: { id: true, name: true, category: { select: { name: true } } }
        }
      }
    });
    if (!mobileBusiness) {
      return NextResponse.json({ error: "Business not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    if (mobileInput.data.paymentMethod !== "PAY_ON_PICKUP_OR_DELIVERY") {
      return NextResponse.json(
        {
          error: "This mobile release supports payment to the business at pickup, dine-in, or service completion only.",
          code: "MOBILE_ONLINE_PAYMENT_NOT_AVAILABLE"
        },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }
    const submittedItemIds = new Set(mobileInput.data.items.map((item) => item.menuItemId));
    const classification = classifyMobileExternalPayment({
      serviceTypeSlug: mobileBusiness.businessServiceType?.slug,
      fulfillmentMode: mobileInput.data.orderType,
      items: mobileBusiness.menuItems.map((item) => ({ name: item.name, category: item.category.name }))
    });
    if (mobileBusiness.menuItems.length !== submittedItemIds.size || !classification.allowed) {
      const code = classification.allowed ? "MOBILE_EXTERNAL_PAYMENT_NOT_ALLOWED" : classification.code;
      return NextResponse.json(
        {
          error:
            code === "MOBILE_REGULATED_GOODS_NOT_AVAILABLE"
              ? "This regulated category is not available in the mobile app."
              : "This purchase is not classified as eligible physical or off-app fulfillment.",
          code
        },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }
    mobileOrderContext = {
      keyHash: mobileOrderKeyHash(mobile.user.id, idempotencyKey!),
      bodyHash: mobileOrderBodyHash(mobileInput.data)
    };
    const replay = await prisma.order.findUnique({
      where: { mobileRequestKeyHash: mobileOrderContext.keyHash },
      select: mobileReplayOrderSelect
    });
    if (replay) {
      if (replay.mobileRequestBodyHash !== mobileOrderContext.bodyHash) {
        return NextResponse.json(
          { error: "This Idempotency-Key was already used for a different order.", code: "MOBILE_IDEMPOTENCY_KEY_REUSED" },
          { status: 409, headers: { "Cache-Control": "no-store" } }
        );
      }
      return mobileOrderReplayResponse(request, replay);
    }
  }
  const ip = getClientIp(request);
  const bucket = await rateLimit(`order:${ip}`, 12, 60_000);
  if (!bucket.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  const parsed = await parseJsonRequest(request, orderSubmissionSchema);
  if (parsed.response) return parsed.response;

  const customerProfileResult = await getVerifiedCustomerProfile({
    businessSlug: parsed.data.businessSlug,
    submittedEmail: parsed.data.customer.email,
    submittedPhone: parsed.data.customer.phone
  });
  if ("response" in customerProfileResult) {
    return customerProfileResult.response;
  }
  const verifiedCustomer = customerProfileResult.profile;
  const now = new Date();

  const business = await prisma.business.findUnique({
    where: { slug: parsed.data.businessSlug },
    include: {
      menuItems: true,
      subscriptions: {
        where: currentPaidSubscriptionWhere(now),
        select: { id: true },
        take: 1
      }
    }
  });

  if (!business) {
    return NextResponse.json({ error: "Business is not accepting requests." }, { status: 404 });
  }
  if (!isEligibleLaunchBusinessLocation(business, { requireCoordinates: true })) {
    return NextResponse.json(
      { error: `VyapaarMate is currently accepting requests only from businesses in ${launchMarket.displayName}.` },
      { status: 403 }
    );
  }
  const copy = getBusinessConsoleCopy(business.businessType);
  if (
    !business.isVerified ||
    business.subscriptionStatus !== "ACTIVE" ||
    business.subscriptions.length === 0 ||
    business.kycStatus !== "APPROVED"
  ) {
    return NextResponse.json({ error: `This business is pending PSHR admin approval and is not accepting ${copy.transactionPlural.toLowerCase()} yet.` }, { status: 403 });
  }
  if (!business.isActive) {
    return NextResponse.json({ error: `Business is not accepting ${copy.transactionPlural.toLowerCase()}.` }, { status: 403 });
  }
  const requestReceivedAt = new Date();
  const paymentConfig = await getOnlinePaymentConfig();

  const fulfillmentModes = fulfillmentModesFromFlags({
    businessType: business.businessType,
    acceptsPickup: business.acceptsPickup,
    acceptsDineIn: business.acceptsDineIn,
    acceptsServiceAtLocation: business.acceptsServiceAtLocation
  });
  if (!fulfillmentModes.includes(parsed.data.orderType)) {
    return NextResponse.json({ error: "This fulfillment option is not available for this business." }, { status: 400 });
  }
  const orderTypeLabel = fulfillmentLabelForBusinessType(business.businessType, parsed.data.orderType).toLowerCase();
  if (parsed.data.paymentMethod === "PAY_ON_PICKUP_OR_DELIVERY" && !business.allowsPayLater) {
    return NextResponse.json({ error: "Cash payment is not available for this business." }, { status: 400 });
  }
  if (parsed.data.paymentMethod === "UPI" && !canBusinessAcceptOnlinePayment(business, paymentConfig)) {
    return NextResponse.json(
      { error: "Platform online payment is not configured right now." },
      { status: 503 }
    );
  }

  const customerWhatsappOptIn = Boolean(
    business.whatsappDisplayPhone &&
    business.whatsappConnected &&
    business.whatsappLiveEnabled &&
    parsed.data.customer.whatsappOptIn
  );
  const customerMarketingOptIn = customerWhatsappOptIn && parsed.data.customer.marketingOptIn;
  const customerEmail = verifiedCustomer.email;

  let customerLatitude: number | null = null;
  let customerLongitude: number | null = null;
  let distanceKm: number | null = null;
  if (parsed.data.orderType === "SERVICE_AT_LOCATION") {
    const businessLatitude = business.latitude === null ? null : Number(business.latitude);
    const businessLongitude = business.longitude === null ? null : Number(business.longitude);
    const serviceRadiusKm = Number(business.serviceRadiusKm);
    customerLatitude = parsed.data.customer.latitude ?? null;
    customerLongitude = parsed.data.customer.longitude ?? null;

    if (businessLatitude === null || businessLongitude === null || serviceRadiusKm <= 0) {
      return NextResponse.json({ error: "This business has not configured a service radius yet." }, { status: 400 });
    }
    if (
      customerLatitude === null ||
      customerLongitude === null ||
      !isValidCoordinate(customerLatitude, customerLongitude)
    ) {
      return NextResponse.json({ error: `Share a valid location to request ${orderTypeLabel}.` }, { status: 400 });
    }
    if (!parsed.data.customer.address?.trim()) {
      return NextResponse.json({ error: `Address is required for ${orderTypeLabel}.` }, { status: 400 });
    }

    distanceKm = Math.round(
      calculateDistanceKm(
        { latitude: businessLatitude, longitude: businessLongitude },
        { latitude: customerLatitude, longitude: customerLongitude }
      ) * 100
    ) / 100;

    if (distanceKm > serviceRadiusKm) {
      return NextResponse.json(
        { error: `This location is ${distanceKm.toFixed(1)} km away, outside the ${serviceRadiusKm.toFixed(1)} km service radius.` },
        { status: 400 }
      );
    }
  }

  const menuMap = new Map(business.menuItems.map((item) => [item.id, item]));
  const unavailableItem = parsed.data.items.find((item) => {
    const menuItem = menuMap.get(item.menuItemId);
    return !menuItem || !menuItem.isAvailable;
  });

  if (unavailableItem) {
    return NextResponse.json({ error: `${copy.itemSingular} ${unavailableItem.menuItemId} is not available.` }, { status: 400 });
  }

  const items = parsed.data.items.map((item) => {
    const menuItem = menuMap.get(item.menuItemId)!;
    const price = Number(menuItem.price);
    return {
      menuItemId: menuItem.id,
      itemName: menuItem.name,
      quantity: item.quantity,
      price,
      total: price * item.quantity
    };
  });
  const appointmentServiceItems = parsed.data.items.filter((item) => menuMap.get(item.menuItemId)?.appointmentEnabled);
  const appointmentRequired =
    business.appointmentBookingEnabled &&
    businessTypeSupportsAppointments(business.businessType) &&
    appointmentServiceItems.length > 0;
  if (appointmentRequired && !parsed.data.appointment) {
    return NextResponse.json(
      { error: "Choose an available professional, date, and time before placing this appointment." },
      { status: 400 }
    );
  }
  if (!appointmentRequired && parsed.data.appointment) {
    return NextResponse.json({ error: "Appointment scheduling is not required for these items." }, { status: 400 });
  }
  if (
    !appointmentRequired &&
    !isBusinessAcceptingNow({ manuallyOpen: business.isOpen, hours: business.businessHours, now })
  ) {
    return NextResponse.json(
      { error: "Business is closed right now. Scheduled appointment services can still be booked for an available future time." },
      { status: 403 }
    );
  }

  const scheduledFor = appointmentRequired
    ? null
    : parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : null;
  if (!appointmentRequired && requiresScheduledServiceTime(business.businessType) && !scheduledFor) {
    return NextResponse.json({ error: `Choose the requested ${copy.transactionSingular.toLowerCase()} date and time.` }, { status: 400 });
  }
  if (scheduledFor) {
    const earliestAllowed = requestReceivedAt.getTime() + 15 * 60 * 1000;
    const latestAllowed = requestReceivedAt.getTime() + 365 * 24 * 60 * 60 * 1000;
    if (scheduledFor.getTime() < earliestAllowed) {
      return NextResponse.json({ error: "Choose a time at least 15 minutes from now." }, { status: 400 });
    }
    if (scheduledFor.getTime() > latestAllowed) {
      return NextResponse.json({ error: "Bookings can be scheduled up to one year in advance." }, { status: 400 });
    }
  }

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const minimumOrder = Number(business.minimumOrder);
  if (minimumOrder > 0 && subtotal < minimumOrder) {
    return NextResponse.json(
      { error: `Minimum request value is ${formatINR(minimumOrder)}.` },
      { status: 400 }
    );
  }
  const deliveryFee = fulfillmentFeeForOrder({
    fee: Number(business.deliveryFee),
    orderType: parsed.data.orderType,
    fulfillmentModes,
    hasItems: items.length > 0
  });
  const couponCode = normalizeCouponCode(parsed.data.couponCode);
  const coupon = couponCode
    ? await prisma.businessCoupon.findUnique({
        where: {
          businessId_code: {
            businessId: business.id,
            code: couponCode
          }
        }
      })
    : null;
  if (couponCode) {
    const couponValidation = validateBusinessCoupon(coupon, subtotal);
    if (!couponValidation.ok) {
      return NextResponse.json({ error: couponValidation.error }, { status: 400 });
    }
  }
  const orderBilling = buildOrderCouponBreakdown({ subtotal, serviceFee: deliveryFee, coupon });
  const totalAmount = orderBilling.total;
  const orderNumber = createOrderNumber();
  const invoiceNumber = `INV-${business.id.slice(-6).toUpperCase()}-${orderNumber}`;
  const placedAt = requestReceivedAt;

  let order: {
    id: string;
    publicToken: string;
    customerId: string;
    status: string;
    appointment: null | {
      startsAt: Date;
      endsAt: Date;
      status: string;
      providerName: string;
      providerTitle: string;
    };
  };
  try {
    order = await prisma.$transaction(async (tx) => {
    const appointmentReservation = appointmentRequired && parsed.data.appointment
      ? await prepareAppointmentReservation({
          db: tx,
          businessId: business.id,
          orderType: parsed.data.orderType,
          items: appointmentServiceItems,
          providerId: parsed.data.appointment.providerId,
          startsAt: parsed.data.appointment.startsAt,
          now: placedAt
        })
      : null;
    const customer = await tx.customer.upsert({
      where: {
        businessId_phone: {
          businessId: business.id,
          phone: verifiedCustomer.phone
        }
      },
      create: {
        businessId: business.id,
        dataOrigin: business.dataOrigin,
        trainingEligible: business.dataOrigin === "LIVE",
        name: verifiedCustomer.name,
        email: customerEmail,
        phone: verifiedCustomer.phone,
        address: parsed.data.customer.address,
        whatsappOptIn: customerWhatsappOptIn,
        marketingOptIn: customerMarketingOptIn,

        totalOrders: 1,
        totalSpent: totalAmount,
        lastOrderAt: placedAt
      },
      update: {
        name: verifiedCustomer.name,
        email: customerEmail,
        address: parsed.data.customer.address,
        whatsappOptIn: customerWhatsappOptIn,
        marketingOptIn: customerMarketingOptIn,
        totalOrders: { increment: 1 },
        totalSpent: { increment: totalAmount },
        lastOrderAt: placedAt
      },
      select: { id: true }
    });

    if (coupon) {
      const couponClaim = await tx.businessCoupon.updateMany({
        where: {
          id: coupon.id,
          businessId: business.id,
          isActive: true,
          OR: [
            { redemptionLimit: null },
            { redeemedCount: { lt: coupon.redemptionLimit ?? 0 } }
          ]
        },
        data: { redeemedCount: { increment: 1 } }
      });
      if (couponClaim.count === 0) {
        throw new Error("This coupon has reached its usage limit.");
      }
    }

    const createdOrder = await tx.order.create({
      data: {
        businessId: business.id,
        dataOrigin: business.dataOrigin,
        trainingEligible: business.dataOrigin === "LIVE",
        customerId: customer.id,
        orderNumber,
        mobileRequestKeyHash: mobileOrderContext?.keyHash ?? null,
        mobileRequestBodyHash: mobileOrderContext?.bodyHash ?? null,
        invoiceNumber,
        invoiceIssuedAt: placedAt,
        subtotal,
        deliveryFee: orderBilling.serviceFee,
        discountAmount: orderBilling.discount,
        taxableAmount: orderBilling.taxableAmount,
        gstRateBps: orderBilling.gstRateBps,
        gstAmount: orderBilling.gstAmount,
        couponCode: coupon?.code ?? null,
        couponId: coupon?.id ?? null,
        totalAmount,
        orderType: parsed.data.orderType,
        deliveryAddress: parsed.data.customer.address,
        customerLatitude,
        customerLongitude,
        distanceKm,
        notes: parsed.data.notes,
        scheduledFor: appointmentReservation?.startsAt ?? scheduledFor,
        status: appointmentReservation?.status === "CONFIRMED" ? "ACCEPTED" : "NEW",
        paymentStatus: "PENDING",
        items: { create: items },
        payment: {
          create: {
            businessId: business.id,
            dataOrigin: business.dataOrigin,
            trainingEligible: business.dataOrigin === "LIVE",
            provider: parsed.data.paymentMethod === "UPI" ? selectedOnlinePaymentProvider(paymentConfig) : "CASH",
            amount: totalAmount,
            status: "PENDING",

          }
        }
      },
      select: { id: true, publicToken: true, customerId: true, status: true }
    });

      if (appointmentReservation) {
        await tx.appointment.create({
          data: {
            businessId: business.id,
            orderId: createdOrder.id,
            customerId: createdOrder.customerId,
            providerId: appointmentReservation.providerId,
            startsAt: appointmentReservation.startsAt,
            endsAt: appointmentReservation.endsAt,
            blockedUntil: appointmentReservation.blockedUntil,
            timezone: appointmentReservation.timezone,
            status: appointmentReservation.status,
            source: appointmentReservation.source,
            autoConfirmed: appointmentReservation.autoConfirmed,
            confirmedAt: appointmentReservation.confirmedAt,
            smartScore: appointmentReservation.smartScore,
            smartReason: appointmentReservation.smartReason
          }
        });
      }

      return {
        ...createdOrder,
        appointment: appointmentReservation
          ? {
              startsAt: appointmentReservation.startsAt,
              endsAt: appointmentReservation.endsAt,
              status: appointmentReservation.status,
              providerName: appointmentReservation.providerName,
              providerTitle: appointmentReservation.providerTitle
            }
          : null
      };
    }, {
      maxWait: 10_000,
      timeout: 15_000
    });
  } catch (error) {
    if (error instanceof AppointmentAvailabilityError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2004") ||
      (error instanceof Error && (error.message.includes("Appointment_provider_time_no_overlap") || error.message.includes("23P01")))
    ) {
      return NextResponse.json(
        { error: "That appointment time was just booked. Choose another available slot.", code: "APPOINTMENT_SLOT_TAKEN" },
        { status: 409 }
      );
    }
    if (error instanceof Error && error.message === "This coupon has reached its usage limit.") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (mobileOrderContext && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const replay = await prisma.order.findUnique({
        where: { mobileRequestKeyHash: mobileOrderContext.keyHash },
        select: mobileReplayOrderSelect
      });
      if (replay && replay.mobileRequestBodyHash === mobileOrderContext.bodyHash) {
        return mobileOrderReplayResponse(request, replay);
      }
    }
    throw error;
  }

  let paymentRequest: Awaited<ReturnType<typeof createCustomerPaymentRequest>> | null = null;
  let paymentSetupError: string | null = null;
  if (parsed.data.paymentMethod === "UPI") {
    try {
      paymentRequest = await createCustomerPaymentRequest({
        appUrl: publicAppUrl(request),
        amount: totalAmount,
        orderNumber,
        orderId: order.id,
        publicToken: order.publicToken,
        customerName: verifiedCustomer.name,
        customerPhone: verifiedCustomer.phone,
        customerEmail,
        business,
        description: `${business.name} ${orderNumber}`,
        notes: {
          kind: "customer_order",
          businessId: business.id,
          orderId: order.id,
          publicToken: order.publicToken,
          orderNumber
        }
      }, paymentConfig);
    } catch (error) {
      paymentSetupError = error instanceof Error ? error.message : "Could not prepare automatic online payment.";
      await prisma.$transaction([
        prisma.payment.update({
          where: { orderId: order.id },
          data: { status: "FAILED" }
        }),
        prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: "FAILED" }
        })
      ]);
      await writeAuditLog({
        businessId: business.id,
        action: "ORDER_PAYMENT_FAILED",
        entity: "Payment",
        entityId: (await prisma.payment.findUnique({ where: { orderId: order.id }, select: { id: true } }))?.id,
        metadata: {
          orderId: order.id,
          orderNumber,
          amount: totalAmount,
          failureReason: paymentSetupError,
          failureSource: "payment_qr_setup"
        }
      });
      paymentRequest = null;
    }
  }

  if (paymentRequest?.paymentRequestId) {
    await prisma.payment.update({
      where: { orderId: order.id },
      data: {
        provider: paymentRequest.provider,
        razorpayPaymentLinkId: null,
        razorpayPaymentId: null,
        cashfreeOrderId: paymentRequest.cashfreeOrderId ?? paymentRequest.paymentRequestId,
        cashfreeCfOrderId: paymentRequest.cashfreeCfOrderId ?? null,
        cashfreePaymentSessionId: paymentRequest.cashfreePaymentSessionId ?? null,
        cashfreePaymentId: null,
        cashfreeOrderStatus: paymentRequest.status,
        paymentRequestUrl: paymentRequest.paymentRequestUrl,
        paymentRequestExpiresAt: new Date(paymentRequest.expiresAt)
      }
    });
  }

  let whatsappNotificationSent = false;
  if (customerWhatsappOptIn) {
    const whatsappConfig = businessWhatsappConfig(business);
    try {
      const itemSummary = items
        .slice(0, 5)
        .map((item) => `${item.quantity} x ${item.itemName}`)
        .join(", ");
      const appointmentSummary = order.appointment
        ? new Intl.DateTimeFormat("en-IN", {
            timeZone: business.appointmentTimezone,
            dateStyle: "medium",
            timeStyle: "short"
          }).format(order.appointment.startsAt)
        : null;
      const whatsappTemplateResult = await sendWhatsAppTemplate({
        phone: verifiedCustomer.phone,
        templateName: "order_received",
        variables: [
          verifiedCustomer.name,
          orderNumber,
          business.name,
          appointmentSummary
            ? `${itemSummary}. Appointment: ${appointmentSummary} with ${order.appointment?.providerName}`
            : itemSummary,
          formatINR(totalAmount),
          parsed.data.paymentMethod === "UPI" ? `Pay online with ${onlinePaymentProviderLabel(paymentConfig.provider)}` : "Cash payment"
        ],
        config: whatsappConfig
      });
      whatsappNotificationSent = whatsappTemplateResult.status !== "placeholder";

      await prisma.whatsappMessage.create({
        data: {
          businessId: business.id,
          customerId: order.customerId,
          orderId: order.id,
          templateName: "order_received",
          phone: verifiedCustomer.phone,
          providerMessageId: whatsappTemplateResult.messageId,
          status: whatsappTemplateResult.status === "placeholder" ? "QUEUED" : "SENT",
          sentAt: whatsappTemplateResult.status === "placeholder" ? null : new Date()
        }
      });
    } catch (error) {
      await prisma.whatsappMessage.create({
        data: {
          businessId: business.id,
          customerId: order.customerId,
          orderId: order.id,
          templateName: "order_received",
          phone: verifiedCustomer.phone,
          status: "FAILED",
          failedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : "WhatsApp message failed."
        }
      });
    }
  }

  const orderUrl = `${publicAppUrl(request)}/order/${order.publicToken}`;
  const paymentReady = parsed.data.paymentMethod !== "UPI" || Boolean(paymentRequest?.paymentRequestUrl);

  return NextResponse.json({
    orderId: order.id,
    orderNumber,
    status: order.status,
    totalAmount,
    paymentQr: paymentRequest,
    paymentUrl: paymentRequest?.paymentRequestUrl ?? null,
    paymentQrImageUrl: paymentRequest?.paymentQrImageUrl ?? null,
    paymentQrExpiresAt: paymentRequest?.expiresAt ?? null,
    paymentMethod: parsed.data.paymentMethod === "UPI" ? "UPI" : "CASH",
    paymentReady,
    paymentSetupError,
    orderUrl,
    invoiceUrl: `${orderUrl}#invoice`,
    whatsappNotificationSent,
    idempotentReplay: false,
    appointment: order.appointment
      ? {
          startsAt: order.appointment.startsAt.toISOString(),
          endsAt: order.appointment.endsAt.toISOString(),
          status: order.appointment.status,
          providerName: order.appointment.providerName,
          providerTitle: order.appointment.providerTitle
        }
      : null,
    message: paymentReady
      ? parsed.data.paymentMethod === "UPI"
        ? paymentConfig.provider === "UPI"
          ? `${copy.transactionSingular} ${orderNumber} received. Pay the PSHR Innovex UPI QR. The business wallet is credited only after PSHR admin verifies the bank transaction.`
          : `${copy.transactionSingular} ${orderNumber} received. Complete the online payment on this website. Payment success updates automatically after ${onlinePaymentProviderLabel(paymentConfig.provider)} confirms it.`
        : `${copy.transactionSingular} ${orderNumber} received. Pay in cash when the business completes this ${copy.transactionSingular.toLowerCase()}.`
      : `${copy.transactionSingular} ${orderNumber} was saved, but automatic online payment could not be prepared. Please contact ${business.name}.`
  });
}
