import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { absoluteUrl, company } from "@/lib/site";
import { portalHomePath, portalLabels, safeAuthNextPath, type AuthPortal } from "@/lib/auth-portal";
import { sendEmail } from "@/services/email";

export const passwordResetLifetimeMs = 30 * 60 * 1000;
const passwordResetLifetimeMinutes = Math.round(passwordResetLifetimeMs / 60_000);

export function createPasswordResetTokenValue() {
  return randomBytes(32).toString("base64url");
}

export function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPasswordResetTokenWithClient(client: Prisma.TransactionClient, userId: string) {
  const token = createPasswordResetTokenValue();
  const tokenHash = hashPasswordResetToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + passwordResetLifetimeMs);

  await client.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: now }
  });
  await client.passwordResetToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt
    }
  });

  return { token, tokenHash, expiresAt };
}

export async function createPasswordResetToken(userId: string) {
  return prisma.$transaction((tx) => createPasswordResetTokenWithClient(tx, userId));
}

export async function revokeUnusedPasswordResetTokens(userId: string) {
  const now = new Date();
  await prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: now }
  });
}

export function passwordResetUrl(token: string, portal: AuthPortal = "business", nextPath?: string | null) {
  const params = new URLSearchParams({ token });
  if (portal !== "business") params.set("type", portal);
  params.set("next", safeAuthNextPath(nextPath) ?? portalHomePath(portal));

  return absoluteUrl(`/reset-password?${params.toString()}`);
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

function buildPasswordResetEmail(input: { name: string; resetUrl: string; portal?: AuthPortal }) {
  const displayName = normalizeDisplayName(input.name);
  const safeName = escapeHtml(displayName);
  const safeResetUrl = escapeHtml(input.resetUrl);
  const safeProduct = escapeHtml(company.product);
  const safeCompanyName = escapeHtml(company.name);
  const safeSupportEmail = escapeHtml(company.supportEmail);
  const portalLabel = portalLabels[input.portal ?? "business"];
  const safePortalLabel = escapeHtml(portalLabel);
  const previewText = `Reset your ${company.product} password securely.`;

  return {
    subject: `Reset your ${company.product} password`,
    text: [
      `Hi ${displayName},`,
      "",
      `We received a request to reset the password for your ${company.product} ${portalLabel} account.`,
      "",
      "Use this secure link to choose a new password:",
      input.resetUrl,
      "",
      `This link expires in ${passwordResetLifetimeMinutes} minutes and can be used only once.`,
      "",
      "If you did not request a password reset, no changes were made. You can safely ignore this email.",
      `For help, contact ${company.supportEmail}.`,
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
                    <div style="margin-top:8px;font-size:13px;line-height:20px;color:#cbd5e1">Secure password recovery</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px">
                    <p style="margin:0 0 16px;font-size:16px;line-height:24px;color:#172033">Hi ${safeName},</p>
                    <p style="margin:0 0 22px;font-size:16px;line-height:24px;color:#334155">
                      We received a request to reset the password for your ${safeProduct} ${safePortalLabel} account. Use the secure button below to choose a new password.
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 24px">
                      <tr>
                        <td style="border-radius:10px;background:#0f766e">
                          <a href="${safeResetUrl}" style="display:inline-block;padding:14px 22px;font-size:15px;font-weight:700;line-height:20px;color:#ffffff;text-decoration:none;border-radius:10px">
                            Reset password
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0 0 18px;font-size:14px;line-height:22px;color:#475569">
                      This link expires in <strong style="color:#172033">${passwordResetLifetimeMinutes} minutes</strong> and can be used only once.
                    </p>
                    <p style="margin:0 0 18px;font-size:14px;line-height:22px;color:#64748b">
                      If the button does not work, copy and paste this link into your browser:
                    </p>
                    <p style="margin:0 0 22px;word-break:break-all;font-size:13px;line-height:20px;color:#0f766e">
                      <a href="${safeResetUrl}" style="color:#0f766e;text-decoration:none">${safeResetUrl}</a>
                    </p>
                    <p style="margin:0;font-size:14px;line-height:22px;color:#64748b">
                      If you did not request this reset, no changes were made. You can safely ignore this email or contact
                      <a href="mailto:${safeSupportEmail}" style="color:#0f766e;text-decoration:none">${safeSupportEmail}</a>.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e6ebf2">
                    <p style="margin:0;font-size:12px;line-height:18px;color:#64748b">
                      This automated message was sent by ${safeCompanyName} for ${safeProduct} account security.
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

export async function sendPasswordResetEmail(input: { email: string; name: string; resetUrl: string; portal?: AuthPortal }) {
  const email = buildPasswordResetEmail({ name: input.name, resetUrl: input.resetUrl, portal: input.portal });

  return sendEmail({
    to: input.email,
    subject: email.subject,
    html: email.html,
    text: email.text
  });
}

function buildStaffInviteEmail(input: { name: string; businessName: string; roleLabel: string; inviteUrl: string }) {
  const displayName = normalizeDisplayName(input.name);
  const safeName = escapeHtml(displayName);
  const safeBusinessName = escapeHtml(input.businessName);
  const safeRoleLabel = escapeHtml(input.roleLabel);
  const safeInviteUrl = escapeHtml(input.inviteUrl);
  const safeProduct = escapeHtml(company.product);
  const safeCompanyName = escapeHtml(company.name);
  const safeSupportEmail = escapeHtml(company.supportEmail);
  const previewText = `${input.businessName} invited you to join their ${company.product} business dashboard.`;

  return {
    subject: `Your ${input.businessName} dashboard invitation on ${company.product}`,
    text: [
      `Hi ${displayName},`,
      "",
      `${input.businessName} has invited you to join their ${company.product} business dashboard as ${input.roleLabel}.`,
      "",
      "After setup, you can access the tools assigned to your role, such as orders, service updates, payments, or customer operations depending on the business configuration.",
      "",
      "Accept the invitation and set your password here:",
      input.inviteUrl,
      "",
      `This link expires in ${passwordResetLifetimeMinutes} minutes and can be used only once.`,
      "For security, do not forward this invitation or share the link with anyone.",
      "",
      `If you were not expecting this invitation, do not use the link. Contact ${input.businessName} or ${company.supportEmail} so the request can be reviewed.`,
      "",
      "Regards,",
      `${company.product} Team`,
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
                    <div style="margin-top:8px;font-size:13px;line-height:20px;color:#cbd5e1">Business staff access invitation</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px">
                    <div style="display:inline-block;margin:0 0 18px;padding:6px 10px;border-radius:999px;background:#ecfdf5;color:#047857;font-size:12px;font-weight:700;line-height:16px;text-transform:uppercase;letter-spacing:.4px">
                      ${safeRoleLabel} Access
                    </div>
                    <p style="margin:0 0 16px;font-size:16px;line-height:24px;color:#172033">Hi ${safeName},</p>
                    <p style="margin:0 0 22px;font-size:16px;line-height:24px;color:#334155">
                      <strong style="color:#172033">${safeBusinessName}</strong> has invited you to join their ${safeProduct} business dashboard as <strong style="color:#172033">${safeRoleLabel}</strong>. Once your password is set, you can access the tools assigned to your role.
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 24px">
                      <tr>
                        <td style="border-radius:10px;background:#0f766e">
                          <a href="${safeInviteUrl}" style="display:inline-block;padding:14px 22px;font-size:15px;font-weight:700;line-height:20px;color:#ffffff;text-decoration:none;border-radius:10px">
                            Accept invitation
                          </a>
                        </td>
                      </tr>
                    </table>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 22px;background:#f8fafc;border:1px solid #e6ebf2;border-radius:12px">
                      <tr>
                        <td style="padding:16px 18px">
                          <p style="margin:0 0 8px;font-size:14px;font-weight:700;line-height:20px;color:#172033">Security note</p>
                          <p style="margin:0;font-size:14px;line-height:22px;color:#475569">
                            This invitation link expires in <strong style="color:#172033">${passwordResetLifetimeMinutes} minutes</strong>, can be used only once, and should not be forwarded or shared.
                          </p>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0 0 18px;font-size:14px;line-height:22px;color:#64748b">
                      If the button does not work, copy and paste this link into your browser:
                    </p>
                    <p style="margin:0 0 22px;word-break:break-all;font-size:13px;line-height:20px;color:#0f766e">
                      <a href="${safeInviteUrl}" style="color:#0f766e;text-decoration:none">${safeInviteUrl}</a>
                    </p>
                    <p style="margin:0;font-size:14px;line-height:22px;color:#64748b">
                      If you were not expecting this invitation, do not use the link. Contact ${safeBusinessName} or
                      <a href="mailto:${safeSupportEmail}" style="color:#0f766e;text-decoration:none">${safeSupportEmail}</a>
                      so the request can be reviewed.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e6ebf2">
                    <p style="margin:0;font-size:12px;line-height:18px;color:#64748b">
                      This automated message was sent by ${safeCompanyName} for ${safeProduct} business access.
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

export async function sendStaffInviteEmail(input: {
  email: string;
  name: string;
  businessName: string;
  roleLabel: string;
  inviteUrl: string;
}) {
  const email = buildStaffInviteEmail(input);

  return sendEmail({
    to: input.email,
    subject: email.subject,
    html: email.html,
    text: email.text
  });
}

function buildSupportAgentInviteEmail(input: { name: string; inviteUrl: string }) {
  const displayName = normalizeDisplayName(input.name);
  const safeName = escapeHtml(displayName);
  const safeInviteUrl = escapeHtml(input.inviteUrl);
  const supportPortalName = `${company.product} Support`;
  const safeSupportPortalName = escapeHtml(supportPortalName);
  const safeSupportEmail = escapeHtml(company.supportEmail);
  const previewText = `You were invited to join ${supportPortalName}.`;

  return {
    subject: `Your ${supportPortalName} invitation`,
    text: [
      `Hi ${displayName},`,
      "",
      `You have been invited to join ${supportPortalName} as a support agent.`,
      "",
      "After setup, you can manage support escalations, review customer and business requests, and respond from the secure support portal.",
      "",
      "Accept the invitation and set your password here:",
      input.inviteUrl,
      "",
      `This link expires in ${passwordResetLifetimeMinutes} minutes and can be used only once.`,
      "For security, do not forward this invitation or share the link with anyone.",
      "",
      `If you were not expecting this invitation, do not use the link. Contact ${company.supportEmail} so we can review the request.`,
      "",
      "Regards,",
      supportPortalName
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
                    <div style="font-size:20px;font-weight:700;letter-spacing:.2px">${safeSupportPortalName}</div>
                    <div style="margin-top:8px;font-size:13px;line-height:20px;color:#cbd5e1">Secure support operations</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px">
                    <div style="display:inline-block;margin:0 0 18px;padding:6px 10px;border-radius:999px;background:#ecfdf5;color:#047857;font-size:12px;font-weight:700;line-height:16px;text-transform:uppercase;letter-spacing:.4px">
                      Support Agent Access
                    </div>
                    <p style="margin:0 0 16px;font-size:16px;line-height:24px;color:#172033">Hi ${safeName},</p>
                    <p style="margin:0 0 22px;font-size:16px;line-height:24px;color:#334155">
                      You have been invited to join ${safeSupportPortalName} as a support agent. Once your password is set, you can manage escalations, review customer and business requests, and respond from the secure support portal.
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 24px">
                      <tr>
                        <td style="border-radius:10px;background:#0f766e">
                          <a href="${safeInviteUrl}" style="display:inline-block;padding:14px 22px;font-size:15px;font-weight:700;line-height:20px;color:#ffffff;text-decoration:none;border-radius:10px">
                            Accept invitation
                          </a>
                        </td>
                      </tr>
                    </table>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 22px;background:#f8fafc;border:1px solid #e6ebf2;border-radius:12px">
                      <tr>
                        <td style="padding:16px 18px">
                          <p style="margin:0 0 8px;font-size:14px;font-weight:700;line-height:20px;color:#172033">Security note</p>
                          <p style="margin:0;font-size:14px;line-height:22px;color:#475569">
                            This invitation link expires in <strong style="color:#172033">${passwordResetLifetimeMinutes} minutes</strong>, can be used only once, and should not be forwarded or shared.
                          </p>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0 0 18px;font-size:14px;line-height:22px;color:#64748b">
                      If the button does not work, copy and paste this link into your browser:
                    </p>
                    <p style="margin:0 0 22px;word-break:break-all;font-size:13px;line-height:20px;color:#0f766e">
                      <a href="${safeInviteUrl}" style="color:#0f766e;text-decoration:none">${safeInviteUrl}</a>
                    </p>
                    <p style="margin:0;font-size:14px;line-height:22px;color:#64748b">
                      If you were not expecting this invitation, do not use the link. Contact
                      <a href="mailto:${safeSupportEmail}" style="color:#0f766e;text-decoration:none">${safeSupportEmail}</a>
                      so we can review the request.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e6ebf2">
                    <p style="margin:0;font-size:12px;line-height:18px;color:#64748b">
                      This automated message was sent for ${safeSupportPortalName} access.
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

export async function sendSupportAgentInviteEmail(input: { email: string; name: string; inviteUrl: string }) {
  const email = buildSupportAgentInviteEmail(input);

  return sendEmail({
    to: input.email,
    subject: email.subject,
    html: email.html,
    text: email.text
  });
}
