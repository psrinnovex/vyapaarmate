import { SubscriptionCheckoutPage, type SubscriptionCheckoutPlanId } from "@/components/dashboard/subscription-checkout-page";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    plan?: string | string[];
  }>;
};

function planFromSearchParam(value: string | string[] | undefined): SubscriptionCheckoutPlanId {
  const plan = Array.isArray(value) ? value[0] : value;
  return plan?.toUpperCase() === "PRO" ? "PRO" : "STARTER";
}

export default async function DashboardBillingCheckoutRoute({ searchParams }: PageProps) {
  const params = await searchParams;
  return <SubscriptionCheckoutPage initialPlan={planFromSearchParam(params?.plan)} />;
}
