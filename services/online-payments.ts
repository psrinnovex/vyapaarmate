import { createCashfreeOrder, canBusinessAcceptCashfreePayment } from "@/services/cashfree";
import { getPlatformPaymentSettings, type PlatformPaymentSettingsValue } from "@/services/platform-payment-settings";
import { createUpiPaymentQr, isValidUpiId } from "@/services/upi";

export type OnlinePaymentProvider = "CASHFREE" | "UPI";

export type OnlinePaymentConfig = PlatformPaymentSettingsValue & {
  gatewayProvider: "CASHFREE";
  provider: OnlinePaymentProvider;
};

export type OnlinePaymentBusiness = {
  id: string;
  name: string;
  cashfreeVendorId?: string | null;
  cashfreeSplitEnabled?: boolean;
  platformFeeBps: number;
};

export type CustomerPaymentRequestInput = {
  appUrl: string;
  amount: number;
  orderNumber: string;
  orderId: string;
  publicToken: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  business: OnlinePaymentBusiness;
  description?: string;
  expiresInMinutes?: number;
  notes?: Record<string, string | number | boolean | null | undefined>;
};

export type CustomerPaymentRequestResult = {
  provider: OnlinePaymentProvider;
  status: string;
  paymentRequestId: string;
  paymentRequestUrl: string | null;
  paymentQrImageUrl: string | null;
  expiresAt: string;
  message: string;
  cashfreeOrderId?: string;
  cashfreeCfOrderId?: string | null;
  cashfreePaymentSessionId?: string;
};

export function resolveCustomerOrderPaymentProvider({
  gatewayProvider
}: {
  gatewayProvider: "CASHFREE";
  directUpiEnabled: boolean;
  upiId: string | null;
}): OnlinePaymentProvider {
  return gatewayProvider;
}

export async function getOnlinePaymentConfig(): Promise<OnlinePaymentConfig> {
  const settings = await getPlatformPaymentSettings();
  const gatewayProvider = "CASHFREE";
  const directUpiEnabled = settings.directUpiEnabled && isValidUpiId(settings.upiId);
  const provider = resolveCustomerOrderPaymentProvider({
    gatewayProvider,
    directUpiEnabled,
    upiId: settings.upiId
  });

  return {
    ...settings,
    directUpiEnabled,
    gatewayProvider,
    provider
  };
}

export function selectedOnlinePaymentProvider(config: OnlinePaymentConfig): OnlinePaymentProvider {
  return config.provider;
}

export function canBusinessAcceptOnlinePayment(business: OnlinePaymentBusiness, config: OnlinePaymentConfig) {
  if (config.provider === "UPI") return isValidUpiId(config.upiId);
  return canBusinessAcceptCashfreePayment(business);
}

export function onlinePaymentProviderLabel(provider: OnlinePaymentProvider) {
  return provider === "CASHFREE" ? "Cashfree" : "PSHR Innovex UPI";
}

function checkoutUrl(appUrl: string, publicToken: string) {
  return `${appUrl.replace(/\/$/, "")}/api/orders/${encodeURIComponent(publicToken)}/cashfree-checkout`;
}

export async function createCustomerPaymentRequest(
  input: CustomerPaymentRequestInput,
  config: OnlinePaymentConfig
): Promise<CustomerPaymentRequestResult> {
  const provider = selectedOnlinePaymentProvider(config);

  if (provider === "UPI") {
    const upiQr = await createUpiPaymentQr({
      amount: input.amount,
      orderNumber: input.orderNumber,
      receiverName: config.upiName,
      upiId: config.upiId,
      upiName: config.upiName,
      description: input.description,
      expiresInMinutes: input.expiresInMinutes
    });

    return {
      provider: "UPI",
      status: upiQr.status,
      paymentRequestId: upiQr.paymentQrId,
      paymentRequestUrl: upiQr.paymentUri,
      paymentQrImageUrl: upiQr.qrImageUrl,
      expiresAt: upiQr.expiresAt,
      message: upiQr.message
    };
  }

  const cashfreeOrder = await createCashfreeOrder({
    amount: input.amount,
    orderNumber: input.orderNumber,
    orderId: input.orderId,
    publicToken: input.publicToken,
    businessId: input.business.id,
    businessName: input.business.name,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail,
    returnUrl: `${input.appUrl.replace(/\/$/, "")}/order/${encodeURIComponent(input.publicToken)}?checkout=return`,
    notifyUrl: `${input.appUrl.replace(/\/$/, "")}/api/webhooks/cashfree`,
    cashfreeVendorId: null,
    cashfreeSplitEnabled: false,
    platformFeeBps: 0,
    expiresInMinutes: input.expiresInMinutes
  });

  return {
    provider: "CASHFREE",
    status: cashfreeOrder.status,
    paymentRequestId: cashfreeOrder.cashfreeOrderId,
    paymentRequestUrl: checkoutUrl(input.appUrl, input.publicToken),
    paymentQrImageUrl: null,
    expiresAt: cashfreeOrder.expiresAt,
    message: cashfreeOrder.message,
    cashfreeOrderId: cashfreeOrder.cashfreeOrderId,
    cashfreeCfOrderId: cashfreeOrder.cashfreeCfOrderId,
    cashfreePaymentSessionId: cashfreeOrder.cashfreePaymentSessionId
  };
}
