import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderStatusPage } from "@/components/order/order-status-page";
import { getPublicOrderReceipt } from "@/lib/order-receipt";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ publicToken: string }>;
};

export const metadata: Metadata = {
  title: "Status and invoice",
  robots: { index: false, follow: false }
};

export default async function PublicOrderStatusRoute({ params }: PageProps) {
  const { publicToken } = await params;
  const order = await getPublicOrderReceipt(publicToken);
  if (!order) notFound();

  return <OrderStatusPage publicToken={publicToken} initialOrder={order} />;
}
