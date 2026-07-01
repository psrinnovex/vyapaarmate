import { NextResponse } from "next/server";
import { getPublicOrderReceipt } from "@/lib/order-receipt";
import { getOrderTrackingCopy } from "@/lib/order-tracking";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ publicToken: string }>;
};

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function dateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function invoiceFileName(invoiceNumber: string) {
  const safeName = invoiceNumber.replace(/[^a-z0-9-]+/gi, "-").replace(/(^-|-$)/g, "") || "invoice";
  return `${safeName}.html`;
}

function titleCase(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function gstRateLabel(gstRateBps: number) {
  return `${(gstRateBps / 100).toFixed(2).replace(/\.00$/, "")}%`;
}

function buildInvoiceHtml(order: NonNullable<Awaited<ReturnType<typeof getPublicOrderReceipt>>>) {
  const paid = order.paymentStatus === "COMPLETED";
  const tracking = getOrderTrackingCopy(order.business.type, order.orderType);
  const transactionTitle = titleCase(tracking.transactionLabel);
  const paymentLabel = order.paymentMethod === "CASH"
    ? "Cash"
    : order.paymentProvider === "CASHFREE"
      ? "Online payment"
      : "PSHR Innovex UPI";
  const rows = order.items.map((item) => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td class="num">${escapeHtml(item.quantity)}</td>
      <td class="num">${escapeHtml(formatINR(item.price))}</td>
      <td class="num"><strong>${escapeHtml(formatINR(item.total))}</strong></td>
    </tr>
  `).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(order.invoiceNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f8fbff; color: #0d1321; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { max-width: 860px; margin: 32px auto; padding: 32px; background: #fff; border: 1px solid #e2e8f0; border-radius: 18px; }
    header, .grid, .total-row { display: flex; justify-content: space-between; gap: 24px; }
    header { align-items: flex-start; border-bottom: 1px solid #e2e8f0; padding-bottom: 24px; }
    h1, h2, p { margin: 0; }
    h1 { margin-top: 8px; font-size: 30px; }
    .eyebrow { color: ${paid ? "#059669" : "#1246a0"}; font-size: 12px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
    .muted { color: #64748b; }
    .right { text-align: right; }
    .pill { display: inline-block; border-radius: 8px; padding: 8px 12px; background: ${paid ? "#ecfdf5" : "#f8fafc"}; color: ${paid ? "#059669" : "#475569"}; border: 1px solid ${paid ? "#bbf7d0" : "#e2e8f0"}; font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .grid { border-bottom: 1px solid #e2e8f0; padding: 24px 0; }
    .block { flex: 1; min-width: 0; }
    .label { color: #64748b; font-size: 12px; font-weight: 800; text-transform: uppercase; }
    .value { margin-top: 10px; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 14px; }
    th { color: #64748b; font-size: 12px; text-align: left; text-transform: uppercase; padding-bottom: 12px; }
    td { border-top: 1px solid #e2e8f0; padding: 14px 0; }
    .num { text-align: right; }
    .totals { margin-left: auto; width: min(360px, 100%); border-top: 1px solid #e2e8f0; padding-top: 12px; }
    .total-row { padding: 8px 0; }
    .grand { margin-top: 8px; border-top: 1px solid #e2e8f0; padding-top: 14px; font-size: 20px; font-weight: 900; }
    .notes { margin-top: 24px; border-radius: 12px; background: #f1f5f9; padding: 14px; color: #475569; }
    footer { margin-top: 30px; color: #64748b; font-size: 12px; line-height: 1.6; }
    @media print {
      body { background: #fff; }
      main { margin: 0; max-width: none; border: 0; border-radius: 0; }
    }
    @media (max-width: 640px) {
      main { margin: 0; min-height: 100vh; border: 0; border-radius: 0; padding: 24px; }
      header, .grid { display: block; }
      .right { margin-top: 18px; text-align: left; }
      table { min-width: 520px; }
      .table-wrap { overflow-x: auto; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <p class="eyebrow">${paid ? "Paid invoice" : `${escapeHtml(transactionTitle)} invoice`}</p>
        <h1>${escapeHtml(order.business.name)}</h1>
        <p class="muted">${escapeHtml(order.business.address)}${order.business.city ? `, ${escapeHtml(order.business.city)}` : ""}${order.business.state ? `, ${escapeHtml(order.business.state)}` : ""}</p>
      </div>
      <div class="right">
        <span class="pill">${paid ? "Paid" : "Cash due"}</span>
        <p class="value">${escapeHtml(order.invoiceNumber)}</p>
        <p class="muted">Issued ${escapeHtml(dateTime(order.invoiceIssuedAt))}</p>
      </div>
    </header>

    <section class="grid">
      <div class="block">
        <p class="label">Billed to</p>
        <p class="value">${escapeHtml(order.customer.name)}</p>
        ${order.customer.email ? `<p class="muted">${escapeHtml(order.customer.email)}</p>` : ""}
        ${order.customer.address ? `<p class="muted">${escapeHtml(order.customer.address)}</p>` : ""}
      </div>
      <div class="block right">
        <p class="label">Payment</p>
        <p class="value">${escapeHtml(paymentLabel)}</p>
        <p class="muted">${paid ? "Paid and verified" : "Due in cash"}</p>
        ${order.paymentId ? `<p class="muted">Payment ID: ${escapeHtml(order.paymentId)}</p>` : ""}
      </div>
    </section>

    <div class="table-wrap">
      <table>
        <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <section class="totals">
      <div class="total-row"><span class="muted">Subtotal</span><span>${escapeHtml(formatINR(order.subtotal))}</span></div>
      ${order.discountAmount > 0 ? `<div class="total-row"><span class="muted">Coupon discount</span><span>-${escapeHtml(formatINR(order.discountAmount))}</span></div>` : ""}
      ${order.serviceFee > 0 ? `<div class="total-row"><span class="muted">Service fee</span><span>${escapeHtml(formatINR(order.serviceFee))}</span></div>` : ""}
      ${order.gstAmount > 0 ? `<div class="total-row"><span class="muted">Taxable amount</span><span>${escapeHtml(formatINR(order.taxableAmount))}</span></div>` : ""}
      ${order.gstAmount > 0 ? `<div class="total-row"><span class="muted">GST ${escapeHtml(gstRateLabel(order.gstRateBps))}</span><span>${escapeHtml(formatINR(order.gstAmount))}</span></div>` : ""}
      <div class="total-row grand"><span>Total</span><span>${escapeHtml(formatINR(order.totalAmount))}</span></div>
    </section>

    ${order.notes ? `<p class="notes"><strong>Notes:</strong> ${escapeHtml(order.notes)}</p>` : ""}
    <footer>Computer-generated invoice for ${escapeHtml(order.orderNumber)}. Contact ${escapeHtml(order.business.name)} for ${escapeHtml(tracking.transactionLabel)} questions.</footer>
  </main>
</body>
</html>`;
}

export async function GET(_request: Request, context: RouteContext) {
  const { publicToken } = await context.params;
  const order = await getPublicOrderReceipt(publicToken);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.paymentMethod !== "CASH" && order.paymentStatus !== "COMPLETED") {
    return NextResponse.json({ error: "Invoice is available after payment verification." }, { status: 409 });
  }

  return new NextResponse(buildInvoiceHtml(order), {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Disposition": `attachment; filename="${invoiceFileName(order.invoiceNumber)}"`,
      "Content-Type": "text/html; charset=utf-8"
    }
  });
}
