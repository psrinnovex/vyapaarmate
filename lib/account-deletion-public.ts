import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { AccountDeletionScope } from "@prisma/client";
import {
  ACCOUNT_DELETION_EMAIL_TOKEN_LIFETIME_MS,
  BUSINESS_ACCOUNT_DELETE_CONFIRMATION,
  BUSINESS_ACCOUNT_RETENTION_NOTICE,
  STAFF_ACCOUNT_RETENTION_NOTICE
} from "@/lib/account-deletion";
import {
  CUSTOMER_ACCOUNT_DELETE_CONFIRMATION,
  CUSTOMER_ACCOUNT_RETENTION_NOTICE
} from "@/lib/customer-account-copy";
import { absoluteUrl, company } from "@/lib/site";
import { sendEmail } from "@/services/email";

const tokenPrefix = "vmdel1";

function deletionTokenPepper() {
  const value = process.env.ACCOUNT_DELETION_TOKEN_PEPPER;
  if (!value || Buffer.byteLength(value, "utf8") < 32) {
    throw new Error("ACCOUNT_DELETION_TOKEN_PEPPER must be set to a separate random value of at least 32 bytes.");
  }
  return value;
}

function hashToken(requestId: string, secret: string) {
  return createHmac("sha256", deletionTokenPepper())
    .update("account-deletion-email\0")
    .update(requestId)
    .update("\0")
    .update(secret)
    .digest("hex");
}

export function createAccountDeletionEmailToken(requestId: string) {
  const secret = randomBytes(32).toString("base64url");
  return {
    raw: `${tokenPrefix}.${requestId}.${secret}`,
    hash: hashToken(requestId, secret),
    expiresAt: new Date(Date.now() + ACCOUNT_DELETION_EMAIL_TOKEN_LIFETIME_MS)
  };
}

export function parseAccountDeletionEmailToken(raw: string) {
  const match = /^vmdel1\.([A-Za-z0-9_-]{16,64})\.([A-Za-z0-9_-]{43})$/.exec(raw);
  if (!match) return null;
  return { requestId: match[1], hash: hashToken(match[1], match[2]) };
}

export function accountDeletionTokenMatches(left: string, right: string) {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function confirmationForDeletionScope(scope: AccountDeletionScope) {
  return scope === "BUSINESS" ? BUSINESS_ACCOUNT_DELETE_CONFIRMATION : CUSTOMER_ACCOUNT_DELETE_CONFIRMATION;
}

export function retentionNoticeForDeletionScope(scope: AccountDeletionScope) {
  if (scope === "BUSINESS") return BUSINESS_ACCOUNT_RETENTION_NOTICE;
  if (scope === "STAFF") return STAFF_ACCOUNT_RETENTION_NOTICE;
  return CUSTOMER_ACCOUNT_RETENTION_NOTICE;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    if (character === "&") return "&amp;";
    if (character === "<") return "&lt;";
    if (character === ">") return "&gt;";
    if (character === '"') return "&quot;";
    return "&#39;";
  });
}

export async function sendAccountDeletionVerificationEmail(input: {
  email: string;
  name: string;
  token: string;
  scope: AccountDeletionScope;
}) {
  const url = `${absoluteUrl("/account-deletion")}#token=${encodeURIComponent(input.token)}`;
  const confirmation = confirmationForDeletionScope(input.scope);
  const safeUrl = escapeHtml(url);
  const safeName = escapeHtml(input.name.trim() || "there");
  const safeProduct = escapeHtml(company.product);
  const safeConfirmation = escapeHtml(confirmation);
  return sendEmail({
    to: input.email,
    subject: `Confirm your ${company.product} deletion request`,
    text: [
      `Hi ${input.name.trim() || "there"},`,
      "",
      `Open this one-time link to review and confirm your ${company.product} deletion request:`,
      url,
      "",
      `The link expires in ${Math.round(ACCOUNT_DELETION_EMAIL_TOKEN_LIFETIME_MS / 60_000)} minutes. You must type ${confirmation} before deletion is scheduled or completed.`,
      "If you did not request this, ignore this email; no account data has been changed."
    ].join("\n"),
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#172033"><h2>${safeProduct} deletion request</h2><p>Hi ${safeName},</p><p>Open the secure one-time link below to review and confirm your deletion request.</p><p><a href="${safeUrl}" style="display:inline-block;background:#b91c1c;color:white;padding:12px 18px;border-radius:8px;text-decoration:none">Review deletion request</a></p><p>This link expires in ${Math.round(ACCOUNT_DELETION_EMAIL_TOKEN_LIFETIME_MS / 60_000)} minutes. You must type <strong>${safeConfirmation}</strong> before any deletion is scheduled or completed.</p><p>If you did not request this, ignore this email; no account data has been changed.</p></div>`
  });
}

export const accountDeletionPublicInternals = { hashToken };
