import { notFound } from "next/navigation";
import { requireBusinessSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { buildSubscriptionCheckoutPayload } from "@/lib/subscription-checkout-payload";
import { SubscriptionPaymentPage } from "@/components/dashboard/subscription-payment-page";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ subscriptionId: string }>;
};

export default async function DashboardBillingPaymentRoute({ params }: PageProps) {
  const auth = await requireBusinessSession("business:billing:read");
  if (auth.response) notFound();
  const { session } = auth;

  const { subscriptionId } = await params;
  const subscription = await prisma.subscription.findFirst({
    where: { id: subscriptionId, businessId: session.businessId },
    select: {
      id: true,
      plan: true,
      amount: true,
      subtotalAmount: true,
      discountAmount: true,
      upgradeCreditAmount: true,
      upgradedFromSubscriptionId: true,
      taxableAmount: true,
      gstRateBps: true,
      gstAmount: true,
      billingGstin: true,
      couponCode: true,
      status: true,
      paymentStatus: true,
      paymentProvider: true,
      paymentRequestUrl: true,
      paymentRequestExpiresAt: true,
      invoiceNumber: true
    }
  });

  if (!subscription) notFound();

  const initialData = await buildSubscriptionCheckoutPayload(subscription);

  return <SubscriptionPaymentPage initialData={initialData} />;
}
