import { randomInt } from "node:crypto";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { company } from "@/lib/site";
import { sendEmail } from "@/services/email";
import { sendOtp, smsVerificationEnabled } from "@/services/sms";

export const verificationCodeLifetimeMs = 10 * 60 * 1000;
export const verificationResendDelayMs = 60 * 1000;
export const maximumVerificationAttempts = 8;
const verificationCodeLifetimeMinutes = Math.round(verificationCodeLifetimeMs / 60_000);

export function createVerificationCode() {
  return randomInt(100_000, 1_000_000).toString();
}

export function hashVerificationCode(code: string) {
  return hashPassword(code);
}

export function verifyEmailCode(code: string, codeHash: string) {
  return verifyPassword(code, codeHash);
}

export function maskEmail(email: string) {
  const [localPart, domain = ""] = email.split("@");
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${"*".repeat(Math.max(2, localPart.length - visible.length))}@${domain}`;
}

export function maskPhone(phone: string | null) {
  if (!phone) return "your phone";
  return `${"*".repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function normalizeDisplayName(name: string) {
  return name.replace(/\s+/g, " ").trim() || "there";
}

function buildRegistrationVerificationEmail(input: { name: string; emailCode: string }) {
  const displayName = normalizeDisplayName(input.name);
  const safeName = escapeHtml(displayName);
  const safeCode = escapeHtml(input.emailCode);
  const safeProduct = escapeHtml(company.product);
  const safeCompanyName = escapeHtml(company.name);
  const safeSupportEmail = escapeHtml(company.supportEmail);
  const previewText = `Use code ${input.emailCode} to verify your ${company.product} account.`;

  return {
    subject: `Verify your ${company.product} account`,
    text: [
      `Hi ${displayName},`,
      "",
      `Use this verification code to finish creating your ${company.product} account:`,
      "",
      input.emailCode,
      "",
      `This code expires in ${verificationCodeLifetimeMinutes} minutes. For your security, do not share this code with anyone.`,
      "",
      `If you did not request this, you can safely ignore this email or contact ${company.supportEmail}.`,
      "",
      `${company.product}`,
      company.name
    ].join("\n"),
    html: `
      <div style="margin:0;padding:0;background:#f4f7fb;color:#172033;font-family:Arial,Helvetica,sans-serif">
        <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden">
          ${escapeHtml(previewText)}
        </span>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f4f7fb;margin:0;padding:0">
          <tr>
            <td align="center" style="padding:32px 16px">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;max-width:600px;background:#ffffff;border:1px solid #e6ebf2;border-radius:14px;overflow:hidden">
                <tr>
                  <td style="padding:28px 32px 20px;background:#0f172a;color:#ffffff">
                    <div style="font-size:20px;font-weight:700;letter-spacing:.2px">${safeProduct}</div>
                    <div style="margin-top:8px;font-size:13px;line-height:20px;color:#cbd5e1">Secure business account verification</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px">
                    <p style="margin:0 0 16px;font-size:16px;line-height:24px;color:#172033">Hi ${safeName},</p>
                    <p style="margin:0 0 22px;font-size:16px;line-height:24px;color:#334155">
                      Enter the verification code below to finish creating your ${safeProduct} account.
                    </p>
                    <div style="margin:0 0 22px;padding:22px 20px;text-align:center;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px">
                      <div style="margin:0 0 8px;font-size:12px;font-weight:700;line-height:16px;letter-spacing:.12em;text-transform:uppercase;color:#64748b">Verification code</div>
                      <div style="font-size:32px;line-height:40px;font-weight:800;letter-spacing:6px;color:#0f172a">${safeCode}</div>
                    </div>
                    <p style="margin:0 0 18px;font-size:14px;line-height:22px;color:#475569">
                      This code expires in <strong style="color:#172033">${verificationCodeLifetimeMinutes} minutes</strong>. For your security, do not share this code with anyone.
                    </p>
                    <p style="margin:0;font-size:14px;line-height:22px;color:#64748b">
                      If you did not request this email, you can safely ignore it or contact
                      <a href="mailto:${safeSupportEmail}" style="color:#0f766e;text-decoration:none">${safeSupportEmail}</a>.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e6ebf2">
                    <p style="margin:0;font-size:12px;line-height:18px;color:#64748b">
                      This automated message was sent by ${safeCompanyName} for ${safeProduct} account verification.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `
  };
}

export async function sendRegistrationCodes(input: {
  email: string;
  phone: string;
  name: string;
  emailCode: string;
}) {
  const phoneVerificationRequired = smsVerificationEnabled();
  const email = buildRegistrationVerificationEmail({ name: input.name, emailCode: input.emailCode });
  const [emailResult, smsResult] = await Promise.all([
    sendEmail({
      to: input.email,
      subject: email.subject,
      html: email.html,
      text: email.text
    }),
    phoneVerificationRequired
      ? sendOtp({ phone: input.phone, purpose: "VERIFY_PHONE" })
      : Promise.resolve({ status: "disabled", phone: input.phone, purpose: "VERIFY_PHONE" as const })
  ]);

  return { emailResult, smsResult, phoneVerificationRequired };
}
