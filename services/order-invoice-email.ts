import type { PaymentProvider, Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { absoluteUrl, company } from "@/lib/site";
import { formatINR } from "@/lib/utils";
import { sendEmail } from "@/services/email";

type InvoiceEmailResult =
  | { status: "sent"; to: string }
  | { status: "skipped"; reason: "order_not_found" | "missing_customer_email" | "not_paid" | "not_refunded" | "already_sent" }
  | { status: "failed"; to: string; reason: string };

type InvoiceOrder = Prisma.OrderGetPayload<{
  include: {
    business: true;
    customer: true;
    items: true;
    payment: true;
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

function paymentLabel(provider: PaymentProvider | null | undefined) {
  if (provider === "CASH") return "Cash";
  if (provider === "UPI") return "PSHR Innovex UPI";
  if (provider === "CASHFREE") return "Online payment";
  return "Payment";
}

function gstRateLabel(gstRateBps: number) {
  return `${(gstRateBps / 100).toFixed(2).replace(/\.00$/, "")}%`;
}

function buildInvoiceEmail(input: {
  order: InvoiceOrder;
  customerEmail: string;
  invoiceUrl: string;
}) {
  const order = input.order;
  const payment = order.payment;
  const invoiceNumber = order.invoiceNumber ?? `INV-${order.orderNumber}`;
  const issuedAt = order.invoiceIssuedAt ?? order.createdAt;
  const paidAt = payment?.paidAt ?? order.updatedAt;
  const subtotal = Number(order.subtotal);
  const serviceFee = Number(order.deliveryFee);
  const discountAmount = Number(order.discountAmount);
  const taxableAmount = Number(order.taxableAmount);
  const gstRateBps = order.gstRateBps;
  const gstAmount = Number(order.gstAmount);
  const totalAmount = Number(order.totalAmount);
  const safeBusinessName = escapeHtml(order.business.name);
  const safeInvoiceNumber = escapeHtml(invoiceNumber);
  const safeCustomerName = escapeHtml(order.customer.name);
  const safeCustomerEmail = escapeHtml(input.customerEmail);
  const safeAddress = escapeHtml(order.deliveryAddress ?? order.customer.address ?? "");
  const rows = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-weight:700">${escapeHtml(item.itemName)}</td>
          <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;text-align:right;color:#475569">${item.quantity}</td>
          <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;text-align:right;color:#475569">${escapeHtml(formatINR(Number(item.price)))}</td>
          <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;text-align:right;color:#0f172a;font-weight:700">${escapeHtml(formatINR(Number(item.total)))}</td>
        </tr>`
    )
    .join("");
  const serviceFeeRow =
    serviceFee > 0
      ? `<tr><td style="padding:6px 0;color:#475569">Service fee</td><td style="padding:6px 0;text-align:right;color:#0f172a">${escapeHtml(formatINR(serviceFee))}</td></tr>`
      : "";
  const discountRow =
    discountAmount > 0
      ? `<tr><td style="padding:6px 0;color:#059669">Coupon discount</td><td style="padding:6px 0;text-align:right;color:#059669">-${escapeHtml(formatINR(discountAmount))}</td></tr>`
      : "";
  const taxTextRows =
    gstAmount > 0
      ? [
          `Taxable amount: ${formatINR(taxableAmount)}`,
          `GST ${gstRateLabel(gstRateBps)}: ${formatINR(gstAmount)}`
        ]
      : [];
  const taxHtmlRows =
    gstAmount > 0
      ? `
                        <tr><td style="padding:6px 0;color:#475569">Taxable amount</td><td style="padding:6px 0;text-align:right;color:#0f172a">${escapeHtml(formatINR(taxableAmount))}</td></tr>
                        <tr><td style="padding:6px 0;color:#475569">GST ${escapeHtml(gstRateLabel(gstRateBps))}</td><td style="padding:6px 0;text-align:right;color:#0f172a">${escapeHtml(formatINR(gstAmount))}</td></tr>`
      : "";
  const paymentId = payment?.cashfreePaymentId ?? payment?.manualVerificationReference ?? null;
  const paymentIdHtml = paymentId
    ? `<p style="margin:4px 0 0;color:#64748b;font-size:12px;word-break:break-all">Payment ID: ${escapeHtml(paymentId)}</p>`
    : "";

  const subject = `Paid invoice ${invoiceNumber} from ${order.business.name}`;
  const text = [
    `Paid invoice ${invoiceNumber}`,
    `${order.business.name}`,
    "",
    `Billed to: ${order.customer.name} <${input.customerEmail}>`,
    safeAddress ? `Address: ${order.deliveryAddress ?? order.customer.address}` : null,
    `Issued: ${dateTime(issuedAt)}`,
    `Paid: ${dateTime(paidAt)}`,
    `Payment: ${paymentLabel(payment?.provider)}`,
    paymentId ? `Payment ID: ${paymentId}` : null,
    "",
    ...order.items.map((item) => `${item.quantity} x ${item.itemName} - ${formatINR(Number(item.total))}`),
    "",
    `Subtotal: ${formatINR(subtotal)}`,
    discountAmount > 0 ? `Coupon discount: -${formatINR(discountAmount)}` : null,
    serviceFee > 0 ? `Service fee: ${formatINR(serviceFee)}` : null,
    ...taxTextRows,
    `Total: ${formatINR(totalAmount)}`,
    "",
    `View invoice: ${input.invoiceUrl}`,
    "",
    company.name
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a">
    <div style="display:none;max-height:0;overflow:hidden">Paid invoice ${safeInvoiceNumber} from ${safeBusinessName}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 12px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
            <tr>
              <td style="padding:28px 28px 18px;border-bottom:1px solid #e2e8f0">
                <p style="margin:0 0 8px;color:#059669;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase">Paid invoice</p>
                <h1 style="margin:0;color:#0f172a;font-size:24px;line-height:1.25">${safeBusinessName}</h1>
                <p style="margin:8px 0 0;color:#64748b;font-size:14px">${safeInvoiceNumber} · Issued ${escapeHtml(dateTime(issuedAt))}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="vertical-align:top;padding-right:16px">
                      <p style="margin:0;color:#64748b;font-size:11px;font-weight:800;text-transform:uppercase">Billed to</p>
                      <p style="margin:8px 0 0;color:#0f172a;font-size:15px;font-weight:800">${safeCustomerName}</p>
                      <p style="margin:4px 0 0;color:#475569;font-size:13px;word-break:break-all">${safeCustomerEmail}</p>
                      ${safeAddress ? `<p style="margin:4px 0 0;color:#475569;font-size:13px;line-height:1.5">${safeAddress}</p>` : ""}
                    </td>
                    <td style="vertical-align:top;text-align:right">
                      <p style="margin:0;color:#64748b;font-size:11px;font-weight:800;text-transform:uppercase">Payment</p>
                      <p style="margin:8px 0 0;color:#0f172a;font-size:15px;font-weight:800">${escapeHtml(paymentLabel(payment?.provider))}</p>
                      <p style="margin:4px 0 0;color:#059669;font-size:13px">Paid and verified · ${escapeHtml(dateTime(paidAt))}</p>
                      ${paymentIdHtml}
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;border-collapse:collapse">
                  <thead>
                    <tr>
                      <th align="left" style="padding:0 0 8px;color:#64748b;font-size:11px;text-transform:uppercase">Item</th>
                      <th align="right" style="padding:0 0 8px;color:#64748b;font-size:11px;text-transform:uppercase">Qty</th>
                      <th align="right" style="padding:0 0 8px;color:#64748b;font-size:11px;text-transform:uppercase">Rate</th>
                      <th align="right" style="padding:0 0 8px;color:#64748b;font-size:11px;text-transform:uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody>${rows}</tbody>
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px">
                  <tr>
                    <td></td>
                    <td style="width:240px">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr><td style="padding:6px 0;color:#475569">Subtotal</td><td style="padding:6px 0;text-align:right;color:#0f172a">${escapeHtml(formatINR(subtotal))}</td></tr>
                        ${discountRow}
                        ${serviceFeeRow}
                        ${taxHtmlRows}
                        <tr><td style="padding:12px 0 0;border-top:1px solid #e2e8f0;color:#0f172a;font-size:18px;font-weight:800">Total</td><td style="padding:12px 0 0;border-top:1px solid #e2e8f0;text-align:right;color:#0f172a;font-size:18px;font-weight:800">${escapeHtml(formatINR(totalAmount))}</td></tr>
                      </table>
                    </td>
                  </tr>
                </table>
                <a href="${escapeHtml(input.invoiceUrl)}" style="display:inline-block;margin-top:24px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:10px;padding:12px 18px;font-size:14px;font-weight:800">View invoice</a>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.5">
                This is an automated invoice email from ${escapeHtml(company.product)} by ${escapeHtml(company.name)}.
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

function buildRefundInvoiceEmail(input: {
  order: InvoiceOrder;
  customerEmail: string;
  orderUrl: string;
}) {
  const order = input.order;
  const payment = order.payment;
  const invoiceNumber = order.invoiceNumber ?? `INV-${order.orderNumber}`;
  const refundInvoiceNumber = `${invoiceNumber}-REFUND`;
  const issuedAt = order.invoiceIssuedAt ?? order.createdAt;
  const refundedAt = order.updatedAt;
  const subtotal = Number(order.subtotal);
  const serviceFee = Number(order.deliveryFee);
  const discountAmount = Number(order.discountAmount);
  const taxableAmount = Number(order.taxableAmount);
  const gstRateBps = order.gstRateBps;
  const gstAmount = Number(order.gstAmount);
  const totalAmount = Number(order.totalAmount);
  const safeBusinessName = escapeHtml(order.business.name);
  const safeInvoiceNumber = escapeHtml(invoiceNumber);
  const safeRefundInvoiceNumber = escapeHtml(refundInvoiceNumber);
  const safeCustomerName = escapeHtml(order.customer.name);
  const safeCustomerEmail = escapeHtml(input.customerEmail);
  const safeAddress = escapeHtml(order.deliveryAddress ?? order.customer.address ?? "");
  const rows = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-weight:700">${escapeHtml(item.itemName)}</td>
          <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;text-align:right;color:#475569">${item.quantity}</td>
          <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;text-align:right;color:#475569">${escapeHtml(formatINR(Number(item.price)))}</td>
          <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;text-align:right;color:#0f172a;font-weight:700">${escapeHtml(formatINR(Number(item.total)))}</td>
        </tr>`
    )
    .join("");
  const serviceFeeRow =
    serviceFee > 0
      ? `<tr><td style="padding:6px 0;color:#475569">Service fee</td><td style="padding:6px 0;text-align:right;color:#0f172a">${escapeHtml(formatINR(serviceFee))}</td></tr>`
      : "";
  const discountRow =
    discountAmount > 0
      ? `<tr><td style="padding:6px 0;color:#059669">Coupon discount</td><td style="padding:6px 0;text-align:right;color:#059669">-${escapeHtml(formatINR(discountAmount))}</td></tr>`
      : "";
  const taxTextRows =
    gstAmount > 0
      ? [
          `Taxable amount: ${formatINR(taxableAmount)}`,
          `GST ${gstRateLabel(gstRateBps)}: ${formatINR(gstAmount)}`
        ]
      : [];
  const taxHtmlRows =
    gstAmount > 0
      ? `
                        <tr><td style="padding:6px 0;color:#475569">Taxable amount</td><td style="padding:6px 0;text-align:right;color:#0f172a">${escapeHtml(formatINR(taxableAmount))}</td></tr>
                        <tr><td style="padding:6px 0;color:#475569">GST ${escapeHtml(gstRateLabel(gstRateBps))}</td><td style="padding:6px 0;text-align:right;color:#0f172a">${escapeHtml(formatINR(gstAmount))}</td></tr>`
      : "";
  const paymentId = payment?.cashfreePaymentId ?? payment?.manualVerificationReference ?? null;
  const paymentIdHtml = paymentId
    ? `<p style="margin:4px 0 0;color:#64748b;font-size:12px;word-break:break-all">Payment ID: ${escapeHtml(paymentId)}</p>`
    : "";

  const subject = `Refund receipt ${refundInvoiceNumber} for ${order.business.name}`;
  const text = [
    `Refund receipt ${refundInvoiceNumber}`,
    `${order.business.name}`,
    "",
    `Original invoice: ${invoiceNumber}`,
    `Order: ${order.orderNumber}`,
    `Billed to: ${order.customer.name} <${input.customerEmail}>`,
    safeAddress ? `Address: ${order.deliveryAddress ?? order.customer.address}` : null,
    `Original invoice issued: ${dateTime(issuedAt)}`,
    `Refund recorded: ${dateTime(refundedAt)}`,
    `Payment: ${paymentLabel(payment?.provider)}`,
    paymentId ? `Payment ID: ${paymentId}` : null,
    `Reason: Order cancellation`,
    "",
    ...order.items.map((item) => `${item.quantity} x ${item.itemName} - ${formatINR(Number(item.total))}`),
    "",
    `Subtotal: ${formatINR(subtotal)}`,
    discountAmount > 0 ? `Coupon discount: -${formatINR(discountAmount)}` : null,
    serviceFee > 0 ? `Service fee: ${formatINR(serviceFee)}` : null,
    ...taxTextRows,
    `Original total: ${formatINR(totalAmount)}`,
    `Refund issued: -${formatINR(totalAmount)}`,
    `Amount returned: ${formatINR(totalAmount)}`,
    "",
    `View order: ${input.orderUrl}`,
    "",
    company.name
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a">
    <div style="display:none;max-height:0;overflow:hidden">Refund receipt ${safeRefundInvoiceNumber} from ${safeBusinessName}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 12px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
            <tr>
              <td style="padding:28px 28px 18px;border-bottom:1px solid #e2e8f0">
                <p style="margin:0 0 8px;color:#7c3aed;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase">Refund receipt</p>
                <h1 style="margin:0;color:#0f172a;font-size:24px;line-height:1.25">${safeBusinessName}</h1>
                <p style="margin:8px 0 0;color:#64748b;font-size:14px">${safeRefundInvoiceNumber} - Original invoice ${safeInvoiceNumber}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="vertical-align:top;padding-right:16px">
                      <p style="margin:0;color:#64748b;font-size:11px;font-weight:800;text-transform:uppercase">Customer</p>
                      <p style="margin:8px 0 0;color:#0f172a;font-size:15px;font-weight:800">${safeCustomerName}</p>
                      <p style="margin:4px 0 0;color:#475569;font-size:13px;word-break:break-all">${safeCustomerEmail}</p>
                      ${safeAddress ? `<p style="margin:4px 0 0;color:#475569;font-size:13px;line-height:1.5">${safeAddress}</p>` : ""}
                    </td>
                    <td style="vertical-align:top;text-align:right">
                      <p style="margin:0;color:#64748b;font-size:11px;font-weight:800;text-transform:uppercase">Refund</p>
                      <p style="margin:8px 0 0;color:#0f172a;font-size:15px;font-weight:800">${escapeHtml(paymentLabel(payment?.provider))}</p>
                      <p style="margin:4px 0 0;color:#7c3aed;font-size:13px">Refunded and recorded - ${escapeHtml(dateTime(refundedAt))}</p>
                      ${paymentIdHtml}
                    </td>
                  </tr>
                </table>
                <div style="margin-top:22px;border:1px solid #ddd6fe;background:#f5f3ff;border-radius:12px;padding:14px 16px;color:#4c1d95;font-size:13px;line-height:1.55">
                  The payment for order ${escapeHtml(order.orderNumber)} was refunded because the order was cancelled. This receipt confirms the reversal against the original invoice.
                </div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;border-collapse:collapse">
                  <thead>
                    <tr>
                      <th align="left" style="padding:0 0 8px;color:#64748b;font-size:11px;text-transform:uppercase">Item</th>
                      <th align="right" style="padding:0 0 8px;color:#64748b;font-size:11px;text-transform:uppercase">Qty</th>
                      <th align="right" style="padding:0 0 8px;color:#64748b;font-size:11px;text-transform:uppercase">Rate</th>
                      <th align="right" style="padding:0 0 8px;color:#64748b;font-size:11px;text-transform:uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody>${rows}</tbody>
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px">
                  <tr>
                    <td></td>
                    <td style="width:260px">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr><td style="padding:6px 0;color:#475569">Subtotal</td><td style="padding:6px 0;text-align:right;color:#0f172a">${escapeHtml(formatINR(subtotal))}</td></tr>
                        ${discountRow}
                        ${serviceFeeRow}
                        ${taxHtmlRows}
                        <tr><td style="padding:12px 0 0;border-top:1px solid #e2e8f0;color:#0f172a;font-weight:800">Original total</td><td style="padding:12px 0 0;border-top:1px solid #e2e8f0;text-align:right;color:#0f172a;font-weight:800">${escapeHtml(formatINR(totalAmount))}</td></tr>
                        <tr><td style="padding:12px 0 0;color:#7c3aed;font-size:18px;font-weight:800">Refund issued</td><td style="padding:12px 0 0;text-align:right;color:#7c3aed;font-size:18px;font-weight:800">-${escapeHtml(formatINR(totalAmount))}</td></tr>
                      </table>
                    </td>
                  </tr>
                </table>
                <a href="${escapeHtml(input.orderUrl)}" style="display:inline-block;margin-top:24px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:10px;padding:12px 18px;font-size:14px;font-weight:800">View order</a>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.5">
                This is an automated refund receipt email from ${escapeHtml(company.product)} by ${escapeHtml(company.name)}.
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

export async function sendPaidOrderInvoiceEmail(orderId: string): Promise<InvoiceEmailResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      business: true,
      customer: true,
      items: true,
      payment: true
    }
  });

  if (!order) return { status: "skipped", reason: "order_not_found" };
  const customerEmail = order.customer.email?.trim().toLowerCase();
  if (!customerEmail) return { status: "skipped", reason: "missing_customer_email" };
  if (order.paymentStatus !== "COMPLETED" || order.payment?.status !== "COMPLETED") {
    return { status: "skipped", reason: "not_paid" };
  }

  const claimedAt = new Date();
  const claim = await prisma.order.updateMany({
    where: { id: order.id, invoiceEmailSentAt: null, paymentStatus: "COMPLETED" },
    data: { invoiceEmailSentAt: claimedAt }
  });
  if (claim.count === 0) return { status: "skipped", reason: "already_sent" };

  const invoiceUrl = absoluteUrl(`/order/${encodeURIComponent(order.publicToken)}#invoice`);
  const email = buildInvoiceEmail({ order, customerEmail, invoiceUrl });

  try {
    const delivery = await sendEmail({
      to: customerEmail,
      subject: email.subject,
      html: email.html,
      text: email.text
    });

    await writeAuditLog({
      userId: null,
      businessId: order.businessId,
      action: "ORDER_INVOICE_EMAIL_SENT",
      entity: "Order",
      entityId: order.id,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        invoiceNumber: order.invoiceNumber ?? `INV-${order.orderNumber}`,
        to: customerEmail,
        status: delivery.status,
        messageId: "messageId" in delivery ? delivery.messageId ?? null : null
      }
    }).catch(() => null);

    return { status: "sent", to: customerEmail };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Invoice email failed.";
    await prisma.order.updateMany({
      where: { id: order.id, invoiceEmailSentAt: claimedAt },
      data: { invoiceEmailSentAt: null }
    });
    await writeAuditLog({
      userId: null,
      businessId: order.businessId,
      action: "ORDER_INVOICE_EMAIL_FAILED",
      entity: "Order",
      entityId: order.id,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        invoiceNumber: order.invoiceNumber ?? `INV-${order.orderNumber}`,
        to: customerEmail,
        reason
      }
    }).catch(() => null);

    return { status: "failed", to: customerEmail, reason };
  }
}

export async function sendRefundedOrderInvoiceEmail(orderId: string): Promise<InvoiceEmailResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      business: true,
      customer: true,
      items: true,
      payment: true
    }
  });

  if (!order) return { status: "skipped", reason: "order_not_found" };
  const customerEmail = order.customer.email?.trim().toLowerCase();
  if (!customerEmail) return { status: "skipped", reason: "missing_customer_email" };
  if (order.paymentStatus !== "REFUNDED" || order.payment?.status !== "REFUNDED") {
    return { status: "skipped", reason: "not_refunded" };
  }

  const claimedAt = new Date();
  const claim = await prisma.order.updateMany({
    where: { id: order.id, refundInvoiceEmailSentAt: null, paymentStatus: "REFUNDED" },
    data: { refundInvoiceEmailSentAt: claimedAt }
  });
  if (claim.count === 0) return { status: "skipped", reason: "already_sent" };

  const orderUrl = absoluteUrl(`/order/${encodeURIComponent(order.publicToken)}`);
  const email = buildRefundInvoiceEmail({ order, customerEmail, orderUrl });

  try {
    const delivery = await sendEmail({
      to: customerEmail,
      subject: email.subject,
      html: email.html,
      text: email.text
    });

    await writeAuditLog({
      userId: null,
      businessId: order.businessId,
      action: "ORDER_REFUND_INVOICE_EMAIL_SENT",
      entity: "Order",
      entityId: order.id,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        invoiceNumber: order.invoiceNumber ?? `INV-${order.orderNumber}`,
        refundInvoiceNumber: `${order.invoiceNumber ?? `INV-${order.orderNumber}`}-REFUND`,
        to: customerEmail,
        status: delivery.status,
        messageId: "messageId" in delivery ? delivery.messageId ?? null : null
      }
    }).catch(() => null);

    return { status: "sent", to: customerEmail };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Refund invoice email failed.";
    await prisma.order.updateMany({
      where: { id: order.id, refundInvoiceEmailSentAt: claimedAt },
      data: { refundInvoiceEmailSentAt: null }
    });
    await writeAuditLog({
      userId: null,
      businessId: order.businessId,
      action: "ORDER_REFUND_INVOICE_EMAIL_FAILED",
      entity: "Order",
      entityId: order.id,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        invoiceNumber: order.invoiceNumber ?? `INV-${order.orderNumber}`,
        refundInvoiceNumber: `${order.invoiceNumber ?? `INV-${order.orderNumber}`}-REFUND`,
        to: customerEmail,
        reason
      }
    }).catch(() => null);

    return { status: "failed", to: customerEmail, reason };
  }
}
