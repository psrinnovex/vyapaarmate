import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DemoCheckout } from "@/components/demo/demo-checkout";
import { getBusinessSession } from "@/lib/api-session";
import { isDemoMode } from "@/lib/demo-mode";
import { prisma } from "@/lib/prisma";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Demo Pay",
  robots: { index: false, follow: false }
};

type PageProps = {
  params: Promise<{ kind: string; id: string }>;
};

export default async function DemoPayPage({ params }: PageProps) {
  if (!isDemoMode()) notFound();
  const { kind, id } = await params;

  if (kind === "order") {
    const orderUrl = `/order/${encodeURIComponent(id)}`;
    const order = await prisma.order.findUnique({
      where: { publicToken: id },
      select: {
        orderNumber: true,
        status: true,
        business: { select: { name: true } },
        payment: { select: { provider: true, status: true, amount: true } }
      }
    });
    if (!order?.payment || order.payment.provider !== "CASHFREE" || order.payment.status !== "PENDING" || order.status === "CANCELLED") {
      redirect(orderUrl);
    }

    return (
      <main className="grid min-h-[100svh] place-items-center px-4 py-10">
        <DemoCheckout
          kind="order"
          id={id}
          amountLabel={formatINR(Number(order.payment.amount))}
          merchant={order.business.name}
          reference={`Order ${order.orderNumber}`}
          backUrl={orderUrl}
        />
      </main>
    );
  }

  if (kind === "subscription") {
    const session = await getBusinessSession();
    if (!session?.businessId) redirect("/login");
    const billingUrl = `/dashboard/billing/payment/${encodeURIComponent(id)}`;
    const subscription = await prisma.subscription.findFirst({
      where: { id, businessId: session.businessId },
      select: { plan: true, amount: true, invoiceNumber: true, paymentProvider: true, paymentStatus: true }
    });
    if (!subscription || subscription.paymentProvider !== "CASHFREE" || subscription.paymentStatus === "COMPLETED") {
      redirect(billingUrl);
    }

    return (
      <main className="grid min-h-[100svh] place-items-center px-4 py-10">
        <DemoCheckout
          kind="subscription"
          id={id}
          amountLabel={formatINR(Number(subscription.amount))}
          merchant="VyapaarMate"
          reference={`${subscription.plan} plan${subscription.invoiceNumber ? ` · ${subscription.invoiceNumber}` : ""}`}
          backUrl={billingUrl}
        />
      </main>
    );
  }

  notFound();
}
