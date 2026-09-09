import { StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getBusinessHome } from "@/api/business";
import { useAuth } from "@/auth/provider";
import { Button, Card, LoadingState, Metric, PageHeader, Pill, Screen, StateView, BodyText } from "@/components/ui";
import { useAppTheme } from "@/theme/theme";
import { formatInr, statusTone } from "@/utils/format";

export default function BusinessHomeScreen() {
  const auth = useAuth();
  const { colors } = useAppTheme();
  const home = useQuery({ queryKey: ["business", "home"], queryFn: getBusinessHome, refetchOnWindowFocus: true });

  if (home.isLoading) return <Screen scroll={false}><LoadingState label="Loading business workspace…" /></Screen>;
  if (home.isError || !home.data) {
    return <Screen scroll={false}><StateView title="Business workspace unavailable" message={home.error?.message ?? "Please try again."} action={<Button label="Try again" onPress={() => void home.refetch()} />} /></Screen>;
  }

  const { payload, scope } = home.data;
  return (
    <Screen>
      <PageHeader eyebrow="Business" title={payload.business.name} subtitle={`${payload.business.businessType} · ${payload.business.city}`} action={<Pill label={payload.business.isOpen ? "Open" : "Closed"} tone={payload.business.isOpen ? "success" : "neutral"} />} />
      <Card>
        <Text style={[styles.welcome, { color: colors.text }]}>Hello, {auth.status === "authenticated" ? auth.user.name : "team"}</Text>
        <BodyText muted>{scope === "overview" ? "Live business summary" : "Your role has an order-focused workspace"}. Pull down on operational lists to refresh.</BodyText>
      </Card>
      {scope === "overview" ? (
        <View style={styles.metrics}>
          <Metric label="Orders today" value={String(payload.metrics.ordersToday)} />
          <Metric label="Revenue today" value={formatInr(payload.metrics.revenueToday)} />
          <Metric label="Pending payments" value={formatInr(payload.metrics.pendingPaymentsAmount)} />
          <Metric label="Customers" value={String(payload.metrics.totalCustomers)} />
        </View>
      ) : null}
      <Text style={[styles.section, { color: colors.text }]}>Recent orders</Text>
      {payload.recentOrders.slice(0, 5).map((order) => (
        <Card key={order.id}>
          <View style={styles.rowBetween}>
            <View style={styles.flex}>
              <Text style={[styles.orderNumber, { color: colors.text }]}>{order.orderNumber}</Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>{order.customer} · {order.items}</Text>
            </View>
            <Pill label={order.status} tone={statusTone(order.status)} />
          </View>
          <Text style={[styles.amount, { color: colors.text }]}>{formatInr(order.amount)}</Text>
        </Card>
      ))}
      {!payload.recentOrders.length ? <StateView title="No recent orders" message="New eligible orders will appear here." /> : null}
      <Card>
        <Text style={[styles.section, { color: colors.text }]}>Mobile business boundary</Text>
        <BodyText muted>Operational tools are available here. Business plan signup, purchase, renewal, pricing, KYC document upload, payout setup, and administrator/support tools remain website-only.</BodyText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  welcome: { fontSize: 19, fontWeight: "800" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  section: { fontSize: 20, fontWeight: "800" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  flex: { flex: 1 },
  orderNumber: { fontSize: 16, fontWeight: "800" },
  meta: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  amount: { fontSize: 17, fontWeight: "800" },
});
