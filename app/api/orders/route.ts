import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getSessionUser } from "@/lib/api-session";
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
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { parseJsonRequest } from "@/lib/security/validation";
import { orderSubmissionSchema } from "@/lib/validations";
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

  const business = await prisma.business.findUnique({
    where: { slug: parsed.data.businessSlug },
    include: { menuItems: true }
  });

  if (!business) {
    return NextResponse.json({ error: "Business is not accepting requests." }, { status: 404 });
  }
  const copy = getBusinessConsoleCopy(business.businessType);
  if (!business.isVerified || business.subscriptionStatus !== "ACTIVE" || business.kycStatus !== "APPROVED") {
    return NextResponse.json({ error: `This business is pending PSHR admin approval and is not accepting ${copy.transactionPlural.toLowerCase()} yet.` }, { status: 403 });
  }
  if (!business.isActive) {
    return NextResponse.json({ error: `Business is not accepting ${copy.transactionPlural.toLowerCase()}.` }, { status: 403 });
  }
  if (!isBusinessAcceptingNow({ manuallyOpen: business.isOpen, hours: business.businessHours })) {
    return NextResponse.json({ error: "Business is closed right now. Please try again when it is open." }, { status: 403 });
  }
  const requestReceivedAt = new Date();
  const scheduledFor = parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : null;
  const requiresScheduledTime = requiresScheduledServiceTime(business.businessType);
  if (requiresScheduledTime && !scheduledFor) {
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

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
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

  let order: { id: string; publicToken: string; customerId: string; status: string };
  try {
    order = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.upsert({
      where: {
        businessId_phone: {
          businessId: business.id,
          phone: verifiedCustomer.phone
        }
      },
      create: {
        businessId: business.id,
        name: verifiedCustomer.name,
        email: customerEmail,
        phone: verifiedCustomer.phone,
        address: parsed.data.customer.address,
        whatsappOptIn: customerWhatsappOptIn,
        marketingOptIn: customerMarketingOptIn,
        dataOrigin: "LIVE",
        trainingEligible: true,
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
        customerId: customer.id,
        orderNumber,
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
        scheduledFor,
        dataOrigin: "LIVE",
        trainingEligible: true,
        status: "NEW",
        paymentStatus: "PENDING",
        items: { create: items },
        payment: {
          create: {
            businessId: business.id,
            provider: parsed.data.paymentMethod === "UPI" ? selectedOnlinePaymentProvider(paymentConfig) : "CASH",
            amount: totalAmount,
            status: "PENDING",
            dataOrigin: "LIVE",
            trainingEligible: true
          }
        }
      },
      select: { id: true, publicToken: true, customerId: true, status: true }
    });

      return createdOrder;
    }, {
      maxWait: 10_000,
      timeout: 15_000
    });
  } catch (error) {
    if (error instanceof Error && error.message === "This coupon has reached its usage limit.") {
      return NextResponse.json({ error: error.message }, { status: 409 });
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
      const whatsappTemplateResult = await sendWhatsAppTemplate({
        phone: verifiedCustomer.phone,
        templateName: "order_received",
        variables: [
          verifiedCustomer.name,
          orderNumber,
          business.name,
          itemSummary,
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
    message: paymentReady
      ? parsed.data.paymentMethod === "UPI"
        ? paymentConfig.provider === "UPI"
          ? `${copy.transactionSingular} ${orderNumber} received. Pay the PSHR Innovex UPI QR. The business wallet is credited only after PSHR admin verifies the bank transaction.`
          : `${copy.transactionSingular} ${orderNumber} received. Complete the online payment on this website. Payment success updates automatically after ${onlinePaymentProviderLabel(paymentConfig.provider)} confirms it.`
        : `${copy.transactionSingular} ${orderNumber} received. Pay in cash when the business completes this ${copy.transactionSingular.toLowerCase()}.`
      : `${copy.transactionSingular} ${orderNumber} was saved, but automatic online payment could not be prepared. Please contact ${business.name}.`
  });
}
