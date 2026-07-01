import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { buildSubscriptionBillingBreakdown, paidSubscriptionAmount, sumPaidSubscriptionAmounts } from "@/lib/billing";
import { buildOrderCouponBreakdown } from "@/lib/coupons";
import { isValidGstin, normalizeGstin } from "@/lib/gstin";
import { publicOrderPaymentFailureReason } from "@/lib/order-receipt";
import { buildSubscriptionCheckoutPayload } from "@/lib/subscription-checkout-payload";
import { formatINR } from "@/lib/utils";
import { adminPlatformPaymentSettingsSchema } from "@/lib/validations";
import { nextPayoutBatchAt, walletAmounts, walletPayoutEligibleAt } from "@/services/business-wallet";
import { paymentCheckoutExpiresInMinutes, verifyCashfreeWebhookSignature } from "@/services/cashfree";
import {
  cashfreePayoutBeneficiaryId,
  cashfreePayoutTransferId,
  extractCashfreePayoutWebhookEvent,
  isCashfreePayoutFailure,
  isCashfreePayoutSuccess,
  verifyCashfreePayoutWebhookSignature
} from "@/services/cashfree-payouts";
import { resolveCustomerOrderPaymentProvider } from "@/services/online-payments";
import { gatewayPaymentMatches } from "@/services/payment-verification";
import { createUpiPaymentUri } from "@/services/upi";

test("gateway payments require an exact amount and currency match", () => {
  process.env.CASHFREE_CURRENCY = "INR";

  assert.equal(
    gatewayPaymentMatches({
      provider: "CASHFREE",
      expectedAmount: 149.99,
      receivedAmount: 149.99,
      receivedCurrency: "inr"
    }),
    true
  );
  assert.equal(
    gatewayPaymentMatches({
      provider: "CASHFREE",
      expectedAmount: 149.99,
      receivedAmount: 149.98,
      receivedCurrency: "INR"
    }),
    false
  );
  assert.equal(
    gatewayPaymentMatches({
      provider: "CASHFREE",
      expectedAmount: 149.99,
      receivedAmount: 149.99,
      receivedCurrency: "USD"
    }),
    false
  );
});

test("wallet credit deducts the configured platform fee in paise", () => {
  assert.deepEqual(walletAmounts(999.99, 250), {
    grossAmount: 999.99,
    platformFee: 24.99,
    netAmount: 975
  });
});

test("wallet credits target the next 9 AM IST payout batch within 24 hours", () => {
  assert.equal(nextPayoutBatchAt(new Date("2026-06-25T03:29:00.000Z")).toISOString(), "2026-06-25T03:30:00.000Z");
  assert.equal(nextPayoutBatchAt(new Date("2026-06-25T03:31:00.000Z")).toISOString(), "2026-06-26T03:30:00.000Z");
});

test("wallet payout eligibility defaults to the daily 9 AM IST batch", () => {
  const originalSettlementDays = process.env.PAYMENT_PROVIDER_SETTLEMENT_DAYS;

  try {
    delete process.env.PAYMENT_PROVIDER_SETTLEMENT_DAYS;
    assert.equal(walletPayoutEligibleAt(new Date("2026-06-25T06:00:00.000Z")).toISOString(), "2026-06-26T03:30:00.000Z");
  } finally {
    if (originalSettlementDays === undefined) {
      delete process.env.PAYMENT_PROVIDER_SETTLEMENT_DAYS;
    } else {
      process.env.PAYMENT_PROVIDER_SETTLEMENT_DAYS = originalSettlementDays;
    }
  }
});

test("INR display always includes two decimal places", () => {
  assert.equal(formatINR(120.98), "₹120.98");
  assert.equal(formatINR(1499), "₹1,499.00");
});

test("platform UPI QR fixes the receiver, amount, currency, and order reference", () => {
  const uri = createUpiPaymentUri({
    amount: 275.5,
    orderNumber: "VM-20260615-ABC123",
    receiverName: "PSHR INNOVEX PRIVATE LIMITED",
    upiId: "payments@bank",
    upiName: "PSHR INNOVEX PRIVATE LIMITED",
    description: "Customer service payment"
  });
  const url = new URL(uri);

  assert.equal(url.protocol, "upi:");
  assert.equal(url.searchParams.get("pa"), "payments@bank");
  assert.equal(url.searchParams.get("pn"), "PSHR INNOVEX PRIVATE LIMITED");
  assert.equal(url.searchParams.get("am"), "275.50");
  assert.equal(url.searchParams.get("cu"), "INR");
  assert.equal(url.searchParams.get("tr"), "VM-20260615-ABC123");
});

test("direct platform UPI cannot be enabled without a valid PSHR receiver", () => {
  assert.equal(
    adminPlatformPaymentSettingsSchema.safeParse({
      directUpiEnabled: true,
      upiId: "",
      upiName: "PSHR INNOVEX PRIVATE LIMITED"
    }).success,
    false
  );
});

test("GSTIN validation normalizes input and verifies the check digit", () => {
  assert.equal(normalizeGstin(" 29abcde1234f1zw "), "29ABCDE1234F1ZW");
  assert.equal(isValidGstin("29ABCDE1234F1ZW"), true);
  assert.equal(isValidGstin("29ABCDE1234F1Z5"), false);
  assert.equal(isValidGstin("29ABCDE1234F1ZWX"), false);
});

test("subscription GST is controlled by the configured rate", () => {
  const originalRate = process.env.SUBSCRIPTION_GST_RATE_BPS;

  try {
    process.env.SUBSCRIPTION_GST_RATE_BPS = "1800";
    assert.deepEqual(buildSubscriptionBillingBreakdown({ plan: "STARTER" }), {
      subtotal: 1499,
      discount: 0,
      upgradeCredit: 0,
      taxableAmount: 1499,
      gstRateBps: 1800,
      gstAmount: 269.82,
      total: 1768.82
    });

    process.env.SUBSCRIPTION_GST_RATE_BPS = "0";
    assert.equal(buildSubscriptionBillingBreakdown({ plan: "STARTER" }).gstAmount, 0);
  } finally {
    if (originalRate === undefined) {
      delete process.env.SUBSCRIPTION_GST_RATE_BPS;
    } else {
      process.env.SUBSCRIPTION_GST_RATE_BPS = originalRate;
    }
  }
});

test("subscription upgrade credit reduces the taxable plan amount", () => {
  const originalRate = process.env.SUBSCRIPTION_GST_RATE_BPS;

  try {
    process.env.SUBSCRIPTION_GST_RATE_BPS = "1800";
    assert.deepEqual(buildSubscriptionBillingBreakdown({ plan: "PRO", upgradeCreditAmount: 1499 }), {
      subtotal: 2999,
      discount: 0,
      upgradeCredit: 1499,
      taxableAmount: 1500,
      gstRateBps: 1800,
      gstAmount: 270,
      total: 1770
    });
  } finally {
    if (originalRate === undefined) {
      delete process.env.SUBSCRIPTION_GST_RATE_BPS;
    } else {
      process.env.SUBSCRIPTION_GST_RATE_BPS = originalRate;
    }
  }
});

test("customer order billing applies coupon discount before service fee GST", () => {
  const originalRate = process.env.ORDER_GST_RATE_BPS;

  try {
    process.env.ORDER_GST_RATE_BPS = "1800";
    assert.deepEqual(
      buildOrderCouponBreakdown({
        subtotal: 10000,
        serviceFee: 120,
        coupon: {
          discountType: "PERCENTAGE",
          discountValue: 10,
          maxDiscountAmount: null
        }
      }),
      {
        subtotal: 10000,
        serviceFee: 120,
        discount: 1000,
        taxableAmount: 9120,
        gstRateBps: 1800,
        gstAmount: 1641.6,
        total: 10761.6
      }
    );
  } finally {
    if (originalRate === undefined) {
      delete process.env.ORDER_GST_RATE_BPS;
    } else {
      process.env.ORDER_GST_RATE_BPS = originalRate;
    }
  }
});

test("subscription revenue uses the paid invoice amount instead of plan list price", () => {
  assert.equal(paidSubscriptionAmount({ amount: "18.00" }), 18);
  assert.equal(
    sumPaidSubscriptionAmounts([
      { amount: "18.00" },
      { amount: "1770.00" }
    ]),
    1788
  );
});

test("customer order payments use the configured gateway even when admin UPI is enabled", () => {
  assert.equal(
    resolveCustomerOrderPaymentProvider({
      gatewayProvider: "CASHFREE",
      directUpiEnabled: true,
      upiId: "payments@bank"
    }),
    "CASHFREE"
  );
});

test("Cashfree webhook signatures include the webhook timestamp", () => {
  const payload = JSON.stringify({ type: "PAYMENT_SUCCESS_WEBHOOK", data: { payment: { cf_payment_id: "123" } } });
  const timestamp = "1770000000000";
  process.env.CASHFREE_SECRET_KEY = "cashfree-test-secret";
  const signature = crypto
    .createHmac("sha256", process.env.CASHFREE_SECRET_KEY)
    .update(`${timestamp}${payload}`)
    .digest("base64");

  assert.equal(verifyCashfreeWebhookSignature(payload, signature, timestamp).verified, true);
  assert.equal(verifyCashfreeWebhookSignature(payload, signature, `${timestamp}1`).verified, false);
});

test("Cashfree payout ids are deterministic and destination-specific", () => {
  const destination = {
    method: "UPI" as const,
    beneficiaryName: "Demo Owner",
    upiId: "owner@bank"
  };
  const beneficiaryId = cashfreePayoutBeneficiaryId({ businessId: "business_1234567890", destination });

  assert.equal(beneficiaryId, cashfreePayoutBeneficiaryId({ businessId: "business_1234567890", destination }));
  assert.notEqual(
    beneficiaryId,
    cashfreePayoutBeneficiaryId({ businessId: "business_1234567890", destination: { ...destination, upiId: "changed@bank" } })
  );
  assert.equal(beneficiaryId.length <= 50, true);
  assert.equal(cashfreePayoutTransferId("payout_1234567890"), cashfreePayoutTransferId("payout_1234567890"));
  assert.equal(cashfreePayoutTransferId("payout_1234567890").length <= 50, true);
});

test("Cashfree payout webhook signatures and statuses are recognized", () => {
  const originalSecret = process.env.CASHFREE_PAYOUTS_WEBHOOK_SECRET;

  try {
    process.env.CASHFREE_PAYOUTS_WEBHOOK_SECRET = "cashfree-payout-test-secret";
    const rawBody = JSON.stringify({
      event: "TRANSFER_SUCCESS",
      transfer_id: "vm_po_test",
      cf_transfer_id: "987654",
      status: "SUCCESS",
      status_code: "COMPLETED",
      transfer_utr: "UTR123"
    });
    const payload = JSON.parse(rawBody) as unknown;
    const signature = crypto
      .createHmac("sha256", process.env.CASHFREE_PAYOUTS_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("base64");
    const event = extractCashfreePayoutWebhookEvent(payload);

    assert.equal(verifyCashfreePayoutWebhookSignature({ rawBody, payload, signature }), true);
    assert.equal(verifyCashfreePayoutWebhookSignature({ rawBody, payload, signature: `${signature}x` }), false);
    assert.equal(event.transferId, "vm_po_test");
    assert.equal(event.cfTransferId, "987654");
    assert.equal(event.utr, "UTR123");
    assert.equal(isCashfreePayoutSuccess(event), true);
    assert.equal(isCashfreePayoutFailure({ status: "REVERSED", statusCode: null }), true);
  } finally {
    if (originalSecret === undefined) {
      delete process.env.CASHFREE_PAYOUTS_WEBHOOK_SECRET;
    } else {
      process.env.CASHFREE_PAYOUTS_WEBHOOK_SECRET = originalSecret;
    }
  }
});

test("Cashfree checkout expiry is always above the provider minimum", () => {
  const originalExpiry = process.env.PAYMENT_CHECKOUT_EXPIRES_MINUTES;
  try {
    delete process.env.PAYMENT_CHECKOUT_EXPIRES_MINUTES;
    assert.equal(paymentCheckoutExpiresInMinutes(), 30);

    process.env.PAYMENT_CHECKOUT_EXPIRES_MINUTES = "10";
    assert.equal(paymentCheckoutExpiresInMinutes(), 16);
  } finally {
    if (originalExpiry === undefined) {
      delete process.env.PAYMENT_CHECKOUT_EXPIRES_MINUTES;
    } else {
      process.env.PAYMENT_CHECKOUT_EXPIRES_MINUTES = originalExpiry;
    }
  }
});

test("public order payment failure copy preserves provider failure reasons", () => {
  assert.equal(
    publicOrderPaymentFailureReason({
      paymentExpired: true,
      paymentProvider: "CASHFREE",
      paymentStatus: "FAILED",
      recordedFailureReason: "Cashfree checkout was closed before a verified payment was received."
    }),
    "Cashfree checkout was closed before a verified payment was received."
  );
  assert.equal(
    publicOrderPaymentFailureReason({
      paymentExpired: true,
      paymentProvider: "CASHFREE",
      paymentStatus: "PENDING",
      recordedFailureReason: null
    }),
    "The payment checkout expired before Cashfree received a verified payment."
  );
  assert.equal(
    publicOrderPaymentFailureReason({
      paymentExpired: false,
      paymentProvider: "CASHFREE",
      paymentStatus: "FAILED",
      recordedFailureReason: null
    }),
    "The payment could not be completed."
  );
});

test("subscription checkout payload treats Cashfree as hosted checkout", async () => {
  const payload = await buildSubscriptionCheckoutPayload({
    id: "sub_test_123",
    plan: "PRO",
    amount: 999,
    status: "PAST_DUE",
    paymentStatus: "PENDING",
    paymentProvider: "CASHFREE",
    paymentRequestUrl: "https://example.com/api/dashboard/billing/checkout/sub_test_123/cashfree",
    paymentRequestExpiresAt: new Date("2026-06-22T12:00:00.000Z"),
    invoiceNumber: "SUBINV-TEST"
  });

  assert.equal(payload.paymentProviderLabel, "Cashfree");
  assert.equal(payload.paymentQrImageUrl, null);
  assert.equal(payload.paymentUrl?.includes("/cashfree"), true);
  assert.match(payload.message, /Cashfree checkout/);
});
