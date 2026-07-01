import crypto from "crypto";

export type CashfreePayoutEnvironment = "sandbox" | "production";
export type CashfreePayoutMethod = "UPI" | "BANK_TRANSFER";

export type CashfreePayoutDestination = {
  method: CashfreePayoutMethod;
  beneficiaryName: string;
  phone?: string | null;
  email?: string | null;
  upiId?: string | null;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
};

export type CashfreePayoutTransferResult = {
  transferId: string;
  cfTransferId: string | null;
  status: string | null;
  statusCode: string | null;
  statusDescription: string | null;
  utr: string | null;
  acknowledged: boolean;
  raw: unknown;
};

export type CashfreePayoutWebhookEvent = {
  eventType: string | null;
  transferId: string | null;
  cfTransferId: string | null;
  status: string | null;
  statusCode: string | null;
  statusDescription: string | null;
  utr: string | null;
  acknowledged: boolean;
  raw: unknown;
};

type CashfreeErrorResponse = {
  message?: string;
  code?: string;
  type?: string;
};

type CashfreeBeneficiaryResponse = CashfreeErrorResponse & {
  beneficiary_id?: string;
  beneficiary_status?: string;
};

type CashfreeTransferResponse = CashfreeErrorResponse & {
  transfer_id?: string;
  cf_transfer_id?: string | number;
  reference_id?: string | number;
  status?: string;
  status_code?: string;
  status_description?: string;
  transfer_utr?: string;
  utr?: string;
  acknowledged?: boolean;
};

const CASHFREE_PAYOUT_API_VERSION = "2024-01-01";
const CASHFREE_PAYOUT_PROVIDER = "CASHFREE_PAYOUTS";
const CASHFREE_PAYOUT_TIMEOUT_MS = 20_000;

function cleanEnv(value: string | undefined) {
  return value?.trim() ?? "";
}

function truthyEnv(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(cleanEnv(value).toLowerCase());
}

export function cashfreePayoutEnvironment(): CashfreePayoutEnvironment {
  return cleanEnv(process.env.CASHFREE_PAYOUTS_ENV).toLowerCase() === "production" ? "production" : "sandbox";
}

function cashfreePayoutBaseUrl() {
  return cashfreePayoutEnvironment() === "production"
    ? "https://api.cashfree.com/payout"
    : "https://sandbox.cashfree.com/payout";
}

export function isCashfreePayoutsConfigured() {
  return Boolean(cleanEnv(process.env.CASHFREE_PAYOUTS_CLIENT_ID) && cleanEnv(process.env.CASHFREE_PAYOUTS_CLIENT_SECRET));
}

export function isCashfreeAutoPayoutEnabled() {
  return truthyEnv(process.env.CASHFREE_PAYOUTS_AUTO_ENABLED);
}

export function cashfreeAutoPayoutMinAmount() {
  const parsed = Number(cleanEnv(process.env.CASHFREE_PAYOUTS_MIN_AMOUNT) || "1");
  return Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
}

export function cashfreePayoutProvider() {
  return CASHFREE_PAYOUT_PROVIDER;
}

function cashfreeHeaders(extra?: HeadersInit): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "x-client-id": cleanEnv(process.env.CASHFREE_PAYOUTS_CLIENT_ID),
    "x-client-secret": cleanEnv(process.env.CASHFREE_PAYOUTS_CLIENT_SECRET),
    "x-api-version": CASHFREE_PAYOUT_API_VERSION,
    ...extra
  };
  const signature = cashfreePayoutSignature();
  return signature ? { ...headers, "x-cf-signature": signature } : headers;
}

function cashfreePayoutPublicKey() {
  const directKey = cleanEnv(process.env.CASHFREE_PAYOUTS_PUBLIC_KEY);
  if (!directKey) return "";
  return directKey.includes("\\n") ? directKey.replace(/\\n/g, "\n") : directKey;
}

function cashfreePayoutSignature() {
  const publicKey = cashfreePayoutPublicKey();
  const clientId = cleanEnv(process.env.CASHFREE_PAYOUTS_CLIENT_ID);
  if (!publicKey || !clientId) return null;

  const signaturePayload = `${clientId}.${Math.floor(Date.now() / 1000)}`;
  return crypto
    .publicEncrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
      },
      Buffer.from(signaturePayload)
    )
    .toString("base64");
}

function requestMessage(payload: CashfreeErrorResponse, status: number) {
  return payload.message ?? payload.code ?? payload.type ?? `Cashfree Payouts request failed with ${status}`;
}

async function cashfreePayoutRequest<T extends CashfreeErrorResponse>(path: string, init: RequestInit = {}) {
  if (!isCashfreePayoutsConfigured()) {
    throw new Error(
      "Cashfree Payouts is not configured. Set CASHFREE_PAYOUTS_CLIENT_ID and CASHFREE_PAYOUTS_CLIENT_SECRET, then restart the app."
    );
  }

  const response = await fetch(`${cashfreePayoutBaseUrl()}${path}`, {
    ...init,
    headers: cashfreeHeaders(init.headers),
    cache: "no-store",
    signal: AbortSignal.timeout(CASHFREE_PAYOUT_TIMEOUT_MS)
  });
  const payload = (await response.json().catch(() => ({}))) as T;

  if (!response.ok) {
    const error = new Error(requestMessage(payload, response.status));
    error.name = `CashfreePayouts${response.status}`;
    throw error;
  }

  return payload;
}

function safeCashfreeId(value: string, fallback: string, maxLength = 50) {
  const cleaned = value.replace(/[^A-Za-z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  return (cleaned || fallback).slice(0, maxLength);
}

function destinationFingerprint(destination: CashfreePayoutDestination) {
  const fingerprintSource = [
    destination.method,
    destination.upiId?.trim().toLowerCase() ?? "",
    destination.bankAccountNumber?.replace(/\s/g, "") ?? "",
    destination.bankIfsc?.trim().toUpperCase() ?? ""
  ].join("|");
  return crypto.createHash("sha256").update(fingerprintSource).digest("hex").slice(0, 12);
}

export function cashfreePayoutBeneficiaryId(input: {
  businessId: string;
  destination: CashfreePayoutDestination;
}) {
  const businessToken = input.businessId.replace(/[^A-Za-z0-9]/g, "").slice(-18) || "business";
  return safeCashfreeId(`vm_b_${businessToken}_${destinationFingerprint(input.destination)}`, `vm_b_${destinationFingerprint(input.destination)}`);
}

export function cashfreePayoutTransferId(payoutId: string) {
  return safeCashfreeId(`vm_po_${payoutId.replace(/[^A-Za-z0-9]/g, "").slice(-36)}`, `vm_po_${Date.now().toString(36)}`);
}

function normalizeBeneficiaryName(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 120);
}

function normalizePhone(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function normalizeAmount(amount: number) {
  return Number(Math.max(0, amount).toFixed(2));
}

function transferModeForDestination(destination: CashfreePayoutDestination) {
  if (destination.method === "UPI") return "upi";
  const configured = cleanEnv(process.env.CASHFREE_PAYOUTS_BANK_TRANSFER_MODE).toLowerCase();
  return configured || "banktransfer";
}

export function isCashfreePayoutSuccess(result: Pick<CashfreePayoutTransferResult, "status" | "statusCode">) {
  const status = result.status?.toUpperCase() ?? "";
  const statusCode = result.statusCode?.toUpperCase() ?? "";
  return status === "SUCCESS" || statusCode === "COMPLETED";
}

export function isCashfreePayoutFailure(result: Pick<CashfreePayoutTransferResult, "status" | "statusCode">) {
  const status = result.status?.toUpperCase() ?? "";
  const statusCode = result.statusCode?.toUpperCase() ?? "";
  return ["FAILED", "REJECTED", "REVERSED", "CANCELLED"].includes(status) || ["FAILED", "REJECTED", "REVERSED"].includes(statusCode);
}

function transferResult(payload: CashfreeTransferResponse, transferId: string): CashfreePayoutTransferResult {
  return {
    transferId: payload.transfer_id ?? transferId,
    cfTransferId: payload.cf_transfer_id === undefined ? (payload.reference_id === undefined ? null : String(payload.reference_id)) : String(payload.cf_transfer_id),
    status: payload.status ?? null,
    statusCode: payload.status_code ?? null,
    statusDescription: payload.status_description ?? null,
    utr: payload.transfer_utr ?? payload.utr ?? null,
    acknowledged: Boolean(payload.acknowledged || payload.status?.toUpperCase() === "RECEIVED"),
    raw: payload
  };
}

export async function ensureCashfreePayoutBeneficiary(input: {
  businessId: string;
  destination: CashfreePayoutDestination;
}) {
  const beneficiaryId = cashfreePayoutBeneficiaryId(input);
  const destination = input.destination;
  const beneficiaryName = normalizeBeneficiaryName(destination.beneficiaryName);
  const phone = normalizePhone(destination.phone);
  const instrument =
    destination.method === "UPI"
      ? { vpa: destination.upiId?.trim() }
      : {
          bank_account_number: destination.bankAccountNumber?.replace(/\s/g, ""),
          bank_ifsc: destination.bankIfsc?.trim().toUpperCase()
        };

  try {
    const response = await cashfreePayoutRequest<CashfreeBeneficiaryResponse>("/beneficiary", {
      method: "POST",
      body: JSON.stringify({
        beneficiary_id: beneficiaryId,
        beneficiary_name: beneficiaryName,
        beneficiary_instrument_details: instrument,
        beneficiary_contact_details: {
          ...(phone ? { beneficiary_phone: phone } : {}),
          ...(destination.email ? { beneficiary_email: destination.email.trim().toLowerCase() } : {})
        }
      })
    });

    return {
      beneficiaryId: response.beneficiary_id ?? beneficiaryId,
      status: response.beneficiary_status ?? "CREATED",
      alreadyExists: false,
      raw: response as unknown
    };
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("already") || message.includes("exist") || message.includes("duplicate")) {
      return {
        beneficiaryId,
        status: "EXISTS",
        alreadyExists: true,
        raw: { message: error instanceof Error ? error.message : "Beneficiary already exists." }
      };
    }
    throw error;
  }
}

export async function createCashfreePayoutTransfer(input: {
  payoutId: string;
  amount: number;
  beneficiaryId: string;
  destination: CashfreePayoutDestination;
  remarks: string;
}) {
  const transferId = cashfreePayoutTransferId(input.payoutId);
  const payload = await cashfreePayoutRequest<CashfreeTransferResponse>("/transfers", {
    method: "POST",
    body: JSON.stringify({
      transfer_id: transferId,
      transfer_amount: normalizeAmount(input.amount),
      transfer_mode: transferModeForDestination(input.destination),
      transfer_remarks: input.remarks.slice(0, 70),
      beneficiary_details: {
        beneficiary_id: input.beneficiaryId
      }
    })
  });

  return transferResult(payload, transferId);
}

export async function getCashfreePayoutTransferStatus(transferId: string) {
  const payload = await cashfreePayoutRequest<CashfreeTransferResponse>(`/transfers?transfer_id=${encodeURIComponent(transferId)}`, {
    method: "GET"
  });
  return transferResult(payload, transferId);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function nestedObject(value: unknown, key: string) {
  return isObject(value) && isObject(value[key]) ? value[key] : null;
}

function stringValue(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return null;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const normalized = stringValue(value);
    if (normalized) return normalized;
  }
  return null;
}

function pickWebhookRoot(payload: unknown) {
  const data = nestedObject(payload, "data");
  const transfer = nestedObject(payload, "transfer");
  const transferDetails = nestedObject(payload, "transfer_details");
  const dataTransfer = data ? nestedObject(data, "transfer") : null;
  const dataTransferDetails = data ? nestedObject(data, "transfer_details") : null;
  return dataTransferDetails ?? dataTransfer ?? transferDetails ?? transfer ?? data ?? (isObject(payload) ? payload : {});
}

export function extractCashfreePayoutWebhookEvent(payload: unknown): CashfreePayoutWebhookEvent {
  const root = pickWebhookRoot(payload);
  const original = isObject(payload) ? payload : {};
  const eventType = firstString(original.event, original.type, original.event_type, original.eventName, root.event, root.type);
  const status = firstString(root.status, root.transfer_status, original.status, original.transferStatus);
  const statusCode = firstString(root.status_code, root.statusCode, original.status_code, original.statusCode);

  return {
    eventType,
    transferId: firstString(root.transfer_id, root.transferId, original.transfer_id, original.transferId),
    cfTransferId: firstString(root.cf_transfer_id, root.cfTransferId, root.reference_id, root.referenceId, original.cf_transfer_id, original.referenceId),
    status,
    statusCode,
    statusDescription: firstString(root.status_description, root.statusDescription, root.reason, original.reason),
    utr: firstString(root.transfer_utr, root.utr, original.transfer_utr, original.utr),
    acknowledged: Boolean(root.acknowledged) || status?.toUpperCase() === "RECEIVED" || eventType?.toUpperCase() === "TRANSFER_ACKNOWLEDGED",
    raw: payload
  };
}

function timingSafeEqualString(first: string, second: string) {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);
  return firstBuffer.length === secondBuffer.length && crypto.timingSafeEqual(firstBuffer, secondBuffer);
}

function hmacSha256(secret: string, value: string, encoding: "hex" | "base64") {
  return crypto.createHmac("sha256", secret).update(value).digest(encoding);
}

function flattenPrimitiveValues(value: unknown, prefix = "", output: Record<string, string> = {}) {
  if (!isObject(value)) return output;

  Object.keys(value).forEach((key) => {
    if (key.toLowerCase() === "signature") return;
    const entry = value[key];
    const path = prefix ? `${prefix}.${key}` : key;
    if (isObject(entry)) {
      flattenPrimitiveValues(entry, path, output);
      return;
    }
    const normalized = stringValue(entry);
    if (normalized !== null) output[path] = normalized;
  });

  return output;
}

function sortedSignaturePayload(payload: unknown) {
  const flattened = flattenPrimitiveValues(payload);
  return Object.keys(flattened)
    .sort()
    .map((key) => flattened[key])
    .join("");
}

function candidateSignatures(input: {
  rawBody: string;
  payload: unknown;
  timestamp?: string | null;
  secret: string;
}) {
  const candidates = [
    hmacSha256(input.secret, input.rawBody, "hex"),
    hmacSha256(input.secret, input.rawBody, "base64"),
    hmacSha256(input.secret, sortedSignaturePayload(input.payload), "base64")
  ];

  if (input.timestamp) {
    candidates.push(hmacSha256(input.secret, `${input.timestamp}${input.rawBody}`, "hex"));
    candidates.push(hmacSha256(input.secret, `${input.timestamp}${input.rawBody}`, "base64"));
  }

  return candidates;
}

export function verifyCashfreePayoutWebhookSignature(input: {
  rawBody: string;
  payload: unknown;
  signature?: string | null;
  timestamp?: string | null;
}) {
  const secret = cleanEnv(process.env.CASHFREE_PAYOUTS_WEBHOOK_SECRET) || cleanEnv(process.env.CASHFREE_PAYOUTS_CLIENT_SECRET);
  const allowUnsigned = truthyEnv(process.env.CASHFREE_PAYOUTS_WEBHOOK_ALLOW_UNSIGNED);

  if (!secret) return process.env.NODE_ENV !== "production" || allowUnsigned;
  if (!input.signature) return process.env.NODE_ENV !== "production" || allowUnsigned;

  return candidateSignatures({
    rawBody: input.rawBody,
    payload: input.payload,
    timestamp: input.timestamp,
    secret
  }).some((candidate) => timingSafeEqualString(candidate, input.signature ?? ""));
}
