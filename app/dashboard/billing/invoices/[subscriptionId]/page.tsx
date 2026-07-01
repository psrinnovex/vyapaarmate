import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { formatINR } from "@/lib/utils";
import { PrintInvoiceButton } from "@/components/invoice/print-invoice-button";
import { StatusPill } from "@/components/ui/status-pill";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ subscriptionId: string }>;
};

function date(value: Date) {
  return value.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function paymentProviderLabel(provider: string) {
  if (provider === "CASHFREE") return "Cashfree";
  if (provider === "UPI") return "PSHR Innovex UPI";
  return "Online payment";
}

export default async function SubscriptionInvoiceRoute({ params }: PageProps) {
  const auth = await requireBusinessSession("business:billing:read");
  if (auth.response) notFound();
  const { session } = auth;

  const { subscriptionId } = await params;
  const subscription = await prisma.subscription.findFirst({
    where: { id: subscriptionId, businessId: session.businessId },
    include: { business: true }
  });
  if (!subscription) notFound();
  const subtotalAmount = Number(subscription.subtotalAmount) > 0 ? Number(subscription.subtotalAmount) : Number(subscription.amount);
  const discountAmount = Number(subscription.discountAmount);
  const upgradeCreditAmount = Number(subscription.upgradeCreditAmount);
  const taxableAmount = Number(subscription.taxableAmount) > 0 ? Number(subscription.taxableAmount) : Math.max(0, subtotalAmount - discountAmount - upgradeCreditAmount);
  const gstAmount = Number(subscription.gstAmount);
  const totalAmount = Number(subscription.amount);

  return (
    <main className="min-h-screen bg-mist px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between gap-3 print:hidden">
          <Link href="/dashboard/billing" className="text-sm font-bold text-ocean">Back to billing</Link>
          <PrintInvoiceButton />
        </div>
        <section className="rounded-lg border border-line bg-white p-7 shadow-sm print:border-0 print:shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-5 border-b border-line pb-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-ocean">Subscription invoice</p>
              <h1 className="mt-2 text-2xl font-bold text-ink">VyapaarMate</h1>
              <p className="mt-1 text-sm text-slate-600">PSHR INNOVEX PRIVATE LIMITED</p>
            </div>
            <div className="sm:text-right">
              <p className="font-bold text-ink">{subscription.invoiceNumber ?? `SUBINV-${subscription.id.slice(-12).toUpperCase()}`}</p>
              <p className="mt-1 text-sm text-slate-500">Issued {date(subscription.createdAt)}</p>
              <div className="mt-2"><StatusPill status={subscription.status} /></div>
            </div>
          </div>

          <div className="grid gap-5 border-b border-line py-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Billed to</p>
              <p className="mt-2 font-bold text-ink">{subscription.business.name}</p>
              <p className="mt-1 text-sm text-slate-600">{subscription.business.ownerName}</p>
              <p className="text-sm text-slate-600">{subscription.business.address}, {subscription.business.city}, {subscription.business.state}</p>
              <p className="text-sm text-slate-600">{subscription.business.email} · {subscription.business.phone}</p>
              {subscription.billingGstin && <p className="text-sm font-semibold text-slate-700">GSTIN: {subscription.billingGstin}</p>}
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-bold uppercase text-slate-500">Billing period</p>
              <p className="mt-2 font-bold text-ink">{date(subscription.startDate)} to {date(subscription.endDate)}</p>
              <p className="mt-1 text-sm text-slate-600">
                {paymentProviderLabel(subscription.paymentProvider)}{" "}
                {subscription.cashfreePaymentId
                  ? `· ${subscription.cashfreePaymentId}`
                  : subscription.manualVerificationReference
                    ? `· UTR ${subscription.manualVerificationReference}`
                    : subscription.paymentStatus === "COMPLETED"
                      ? "· payment confirmed"
                      : "· payment pending"}
              </p>
              {subscription.paidAt && <p className="text-sm text-slate-600">Paid {date(subscription.paidAt)}</p>}
            </div>
          </div>

          <table className="my-6 w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500"><tr><th className="pb-3">Description</th><th className="pb-3 text-right">Amount</th></tr></thead>
            <tbody className="border-y border-line">
              <tr><td className="py-4 font-semibold text-ink">VyapaarMate {subscription.plan.toLowerCase()} plan, 30 days</td><td className="py-4 text-right font-semibold">{formatINR(subtotalAmount)}</td></tr>
            </tbody>
          </table>

          <div className="ml-auto max-w-sm">
            <div className="flex justify-between py-2 text-slate-600"><span>Subscription amount</span><span>{formatINR(subtotalAmount)}</span></div>
            {discountAmount > 0 && (
              <div className="flex justify-between py-2 text-emerald"><span>Coupon {subscription.couponCode ? `(${subscription.couponCode})` : ""}</span><span>-{formatINR(discountAmount)}</span></div>
            )}
            {upgradeCreditAmount > 0 && (
              <div className="flex justify-between py-2 text-emerald"><span>Current subscription credit</span><span>-{formatINR(upgradeCreditAmount)}</span></div>
            )}
            <div className="flex justify-between py-2 text-slate-600"><span>Taxable amount</span><span>{formatINR(taxableAmount)}</span></div>
            <div className="flex justify-between py-2 text-slate-600"><span>GST {(subscription.gstRateBps / 100).toFixed(2)}%</span><span>{formatINR(gstAmount)}</span></div>
            <div className="mt-2 flex justify-between border-t border-line pt-4 text-xl font-bold text-ink"><span>Total</span><span>{formatINR(totalAmount)}</span></div>
          </div>

          <p className="mt-8 text-xs leading-5 text-slate-500">Computer-generated subscription invoice. Payment gateway verification uses the final total shown on this invoice.</p>
        </section>
      </div>
    </main>
  );
}
