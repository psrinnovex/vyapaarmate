import type { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { absoluteUrl, company } from "@/lib/site";
import { formatINR } from "@/lib/utils";
import { sendEmail } from "@/services/email";

export type BusinessPayoutEmailResult =
  | { status: "queued" | "placeholder"; to: string }
  | { status: "skipped"; reason: "payout_not_found" | "missing_business_email" }
  | { status: "failed"; to: string; reason: string };

type BusinessPayoutForEmail = Prisma.BusinessPayoutGetPayload<{
  include: {
    business: {
      select: {
        id: true;
        name: true;
        ownerName: true;
        email: true;
        payoutMethod: true;
        payoutUpiId: true;
        payoutUpiName: true;
        payoutAccountHolderName: true;
        payoutBankName: true;
        payoutBankAccountNumber: true;
        payoutBankIfsc: true;
      };
    };
    walletEntries: {
      where: { type: "ORDER_PAYMENT_CREDIT" };
      select: { amount: true; grossAmount: true; platformFee: true };
    };
  };
}>;

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "\"":
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

function dateTime(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata"
  }).format(value);
}

function maskedAccountNumber(value: string | null) {
  if (!value) return "";
  const suffix = value.slice(-4);
  return suffix ? `**** ${suffix}` : "";
}

function payoutMethodLabel(method: string) {
  if (method === "UPI") return "UPI";
  if (method === "BANK_TRANSFER") return "Bank transfer";
  return method.replace(/_/g, " ");
}

function payoutDestinationLabel(business: BusinessPayoutForEmail["business"]) {
  if (business.payoutMethod === "UPI") {
    return business.payoutUpiId
      ? `UPI ${business.payoutUpiId}${business.payoutUpiName ? ` (${business.payoutUpiName})` : ""}`
      : "UPI payout destination";
  }

  const account = maskedAccountNumber(business.payoutBankAccountNumber);
  return [business.payoutBankName, account ? `A/c ${account}` : "", business.payoutBankIfsc ? `IFSC ${business.payoutBankIfsc}` : ""]
    .filter(Boolean)
    .join(" - ") || "Bank payout destination";
}

function buildBusinessPayoutEmail(payout: BusinessPayoutForEmail) {
  const business = payout.business;
  const payoutAmount = Number(payout.amount);
  const grossAmount = payout.walletEntries.reduce((sum, entry) => sum + Number(entry.grossAmount), 0);
  const platformFee = payout.walletEntries.reduce((sum, entry) => sum + Number(entry.platformFee), 0);
  const paidAt = payout.paidAt ?? payout.createdAt;
  const destination = payoutDestinationLabel(business);
  const method = payoutMethodLabel(payout.method);
  const reference = payout.reference?.trim() || "Not provided";
  const notes = payout.notes?.trim() || "";
  const dashboardUrl = absoluteUrl("/dashboard/payments");
  const safeBusinessName = escapeHtml(business.name);
  const safeOwnerName = escapeHtml(business.ownerName);
  const safePayoutId = escapeHtml(payout.id);
  const safeMethod = escapeHtml(method);
  const safeReference = escapeHtml(reference);
  const safeDestination = escapeHtml(destination);
  const safePaidAt = escapeHtml(dateTime(paidAt));
  const safeSupportEmail = escapeHtml(company.supportEmail);
  const safeDashboardUrl = escapeHtml(dashboardUrl);
  const noteHtml = notes
    ? `<tr><td style="padding:8px 0;color:#64748b">Admin note</td><td style="padding:8px 0;text-align:right;color:#0f172a">${escapeHtml(notes)}</td></tr>`
    : "";
  const noteText = notes ? [`Admin note: ${notes}`] : [];

  const subject = `Payout paid: ${formatINR(payoutAmount)} for ${business.name}`;
  const text = [
    `Payout paid for ${business.name}`,
    "",
    `Hi ${business.ownerName},`,
    `Your ${company.product} wallet payout has been recorded as paid by ${company.name}.`,
    "",
    `Net payout amount: ${formatINR(payoutAmount)}`,
    `Gross customer payments included: ${formatINR(grossAmount || payoutAmount + platformFee)}`,
    `Platform fees retained: ${formatINR(platformFee)}`,
    `Settled wallet credits: ${payout.walletEntries.length}`,
    `Paid on: ${dateTime(paidAt)}`,
    `Method: ${method}`,
    `Reference: ${reference}`,
    `Destination: ${destination}`,
    `Payout ID: ${payout.id}`,
    ...noteText,
    "",
    `View payments: ${dashboardUrl}`,
    "",
    `If the amount is not visible in your bank or UPI app, contact ${company.supportEmail} with the payout ID and reference above.`,
    "",
    company.name
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a">
    <div style="display:none;max-height:0;overflow:hidden">Your payout of ${escapeHtml(formatINR(payoutAmount))} has been recorded as paid.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 12px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
            <tr>
              <td style="padding:28px 28px 20px;border-bottom:1px solid #e2e8f0">
                <p style="margin:0 0 8px;color:#059669;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase">Payout paid</p>
                <h1 style="margin:0;color:#0f172a;font-size:24px;line-height:1.25">${escapeHtml(formatINR(payoutAmount))}</h1>
                <p style="margin:8px 0 0;color:#64748b;font-size:14px">${safeBusinessName} - ${safePaidAt}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px">
                <p style="margin:0 0 14px;color:#334155;font-size:15px;line-height:1.6">Hi ${safeOwnerName}, your ${escapeHtml(company.product)} wallet payout has been recorded as paid by ${escapeHtml(company.name)}.</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
                  <tr><td style="padding:8px 0;color:#64748b">Net payout amount</td><td style="padding:8px 0;text-align:right;color:#0f172a;font-weight:800">${escapeHtml(formatINR(payoutAmount))}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b">Gross customer payments included</td><td style="padding:8px 0;text-align:right;color:#0f172a">${escapeHtml(formatINR(grossAmount || payoutAmount + platformFee))}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b">Platform fees retained</td><td style="padding:8px 0;text-align:right;color:#0f172a">${escapeHtml(formatINR(platformFee))}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b">Settled wallet credits</td><td style="padding:8px 0;text-align:right;color:#0f172a">${payout.walletEntries.length}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b">Method</td><td style="padding:8px 0;text-align:right;color:#0f172a">${safeMethod}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b">Reference</td><td style="padding:8px 0;text-align:right;color:#0f172a;word-break:break-word">${safeReference}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b">Destination</td><td style="padding:8px 0;text-align:right;color:#0f172a;word-break:break-word">${safeDestination}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b">Payout ID</td><td style="padding:8px 0;text-align:right;color:#0f172a;word-break:break-word">${safePayoutId}</td></tr>
                  ${noteHtml}
                </table>
                <a href="${safeDashboardUrl}" style="display:inline-block;margin-top:24px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:10px;padding:12px 18px;font-size:14px;font-weight:800">View payments</a>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.5">
                If the amount is not visible in your bank or UPI app, contact <a href="mailto:${safeSupportEmail}" style="color:#0f766e;text-decoration:none">${safeSupportEmail}</a> with the payout ID and reference above.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}

export async function sendBusinessPayoutEmail(
  payoutId: string,
  options: { actorUserId?: string | null } = {}
): Promise<BusinessPayoutEmailResult> {
  const payout = await prisma.businessPayout.findUnique({
    where: { id: payoutId },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          ownerName: true,
          email: true,
          payoutMethod: true,
          payoutUpiId: true,
          payoutUpiName: true,
          payoutAccountHolderName: true,
          payoutBankName: true,
          payoutBankAccountNumber: true,
          payoutBankIfsc: true
        }
      },
      walletEntries: {
        where: { type: "ORDER_PAYMENT_CREDIT" },
        select: { amount: true, grossAmount: true, platformFee: true }
      }
    }
  });

  if (!payout) return { status: "skipped", reason: "payout_not_found" };

  const to = payout.business.email.trim().toLowerCase();
  if (!to) return { status: "skipped", reason: "missing_business_email" };

  const email = buildBusinessPayoutEmail(payout);

  try {
    const delivery = await sendEmail({
      to,
      subject: email.subject,
      html: email.html,
      text: email.text
    });
    const deliveryStatus: "queued" | "placeholder" = delivery.status === "placeholder" ? "placeholder" : "queued";

    await writeAuditLog({
      userId: options.actorUserId ?? null,
      businessId: payout.businessId,
      action: "BUSINESS_PAYOUT_EMAIL_QUEUED",
      entity: "BusinessPayout",
      entityId: payout.id,
      metadata: {
        payoutId: payout.id,
        to,
        amount: Number(payout.amount),
        method: payout.method,
        reference: payout.reference,
        deliveryStatus,
        messageId: "messageId" in delivery ? delivery.messageId ?? null : null
      }
    }).catch(() => null);

    return { status: deliveryStatus, to };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Payout email failed.";
    await writeAuditLog({
      userId: options.actorUserId ?? null,
      businessId: payout.businessId,
      action: "BUSINESS_PAYOUT_EMAIL_FAILED",
      entity: "BusinessPayout",
      entityId: payout.id,
      metadata: {
        payoutId: payout.id,
        to,
        amount: Number(payout.amount),
        method: payout.method,
        reference: payout.reference,
        reason
      }
    }).catch(() => null);

    return { status: "failed", to, reason };
  }
}
