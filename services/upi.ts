import QRCode from "qrcode";

const UPI_ID_PATTERN = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9._-]{2,64}$/;

export type UpiPaymentQrInput = {
  amount: number;
  orderNumber: string;
  receiverName: string;
  upiId: string | null | undefined;
  upiName?: string | null;
  description?: string | null;
  expiresInMinutes?: number;
};

export type UpiPaymentQrResult = {
  provider: "UPI";
  status: "created";
  paymentQrId: string;
  qrImageUrl: string | null;
  paymentUri: string;
  expiresAt: string;
  message: string;
};

function configuredExpiryMinutes(expiresInMinutes?: number) {
  const configured = Number(process.env.PAYMENT_UPI_QR_EXPIRES_MINUTES ?? 30);
  const requested = expiresInMinutes ?? (Number.isFinite(configured) ? configured : 30);
  return Math.min(60, Math.max(15, requested));
}

function cleanUpiId(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function cleanReceiverName(value: string | null | undefined, fallback: string) {
  return (value?.trim() || fallback.trim()).slice(0, 80);
}

export function isValidUpiId(value: string | null | undefined) {
  return UPI_ID_PATTERN.test(cleanUpiId(value));
}

export function createUpiPaymentUri(input: UpiPaymentQrInput) {
  const upiId = cleanUpiId(input.upiId);
  if (!isValidUpiId(upiId)) {
    throw new Error("PSHR Innovex UPI ID is not configured. Add a valid receiver in admin settings.");
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  const description = (input.description?.trim() || `${input.receiverName} payment for ${input.orderNumber}`).slice(0, 80);
  const params = new URLSearchParams({
    pa: upiId,
    pn: cleanReceiverName(input.upiName, input.receiverName),
    am: amount.toFixed(2),
    cu: "INR",
    tn: description,
    tr: input.orderNumber.slice(0, 35)
  });

  return `upi://pay?${params.toString()}`;
}

export async function createUpiQrImageDataUrl(paymentUri: string) {
  return QRCode.toDataURL(paymentUri, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
    color: {
      dark: "#0f172a",
      light: "#ffffff"
    }
  });
}

export async function createUpiPaymentQr(input: UpiPaymentQrInput): Promise<UpiPaymentQrResult> {
  const paymentUri = createUpiPaymentUri(input);
  const qrImageUrl = await createUpiQrImageDataUrl(paymentUri);
  const expiresAt = new Date(Date.now() + configuredExpiryMinutes(input.expiresInMinutes) * 60_000).toISOString();

  return {
    provider: "UPI",
    status: "created",
    paymentQrId: `upi_${input.orderNumber}`,
    qrImageUrl,
    paymentUri,
    expiresAt,
    message: "PSHR Innovex UPI QR created. Payment requires admin bank verification."
  };
}
