import { StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getBusinessHome } from "@/api/business";
import { useAuth } from "@/auth/provider";
import { Illustration } from "@/components/illustrations";
import { Button, Card, LoadingState, Metric, PageHeader, Pill, Screen, StateView, BodyText, SectionTitle } from "@/components/ui";
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
      <PageHeader
        eyebrow="Business"
        title={payload.business.name}
        subtitle={`${payload.business.businessType} · ${payload.business.city}`}
        illustration="chart"
        action={<Pill label={payload.business.isOpen ? "Open" : "Closed"} tone={payload.business.isOpen ? "success" : "neutral"} />}
      />
      <View style={[styles.welcomeCard, { backgroundColor: colors.contrast, boxShadow: colors.clayShadow }]}>
        <View style={styles.flex}>
          <Text style={[styles.welcome, { color: colors.onContrast }]}>Hello, {auth.status === "authenticated" ? auth.user.name : "team"}</Text>
          <Text style={[styles.welcomeCopy, { color: colors.onContrast }]}>{scope === "overview" ? "Live business summary" : "Your role has an order-focused workspace"}. Pull down on operational lists to refresh.</Text>
        </View>
        <Illustration name="rocket" size={64} />
      </View>
      {scope === "overview" ? (
        <View style={styles.metrics}>
          <Metric label="Orders today" value={String(payload.metrics.ordersToday)} illustration="bag" />
          <Metric label="Revenue today" value={formatInr(payload.metrics.revenueToday)} illustration="upi" />
          <Metric label="Pending payments" value={formatInr(payload.metrics.pendingPaymentsAmount)} illustration="bell" />
          <Metric label="Customers" value={String(payload.metrics.totalCustomers)} illustration="customers" />
        </View>
      ) : null}
      <SectionTitle detail={`${Math.min(5, payload.recentOrders.length)} shown`}>Recent orders</SectionTitle>
      {payload.recentOrders.slice(0, 5).map((order) => (
        <Card key={order.id}>
          <View style={styles.rowBetween}>
            <View style={[styles.orderArt, { backgroundColor: colors.surfaceMuted, boxShadow: colors.insetShadow }]}>
              <Illustration name="bag" size={34} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.orderNumber, { color: colors.text }]}>{order.orderNumber}</Text>
              <Text numberOfLines={2} style={[styles.meta, { color: colors.textMuted }]}>{order.customer} · {order.items}</Text>
            </View>
            <Text style={[styles.amount, { color: colors.text }]}>{formatInr(order.amount)}</Text>
          </View>
          <Pill label={order.status} tone={statusTone(order.status)} />
        </Card>
      ))}
      {!payload.recentOrders.length ? <StateView title="No recent orders" message="New eligible orders will appear here." illustration="bag" /> : null}
      <Card>
        <View style={styles.rowBetween}>
          <Illustration name="shield" size={40} />
          <Text style={[styles.section, styles.flex, { color: colors.text }]}>Mobile business boundary</Text>
        </View>
        <BodyText muted>Operational tools are available here. Business plan signup, purchase, renewal, pricing, KYC document upload, payout setup, and administrator/support tools remain website-only.</BodyText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  welcomeCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 26, padding: 18 },
  welcome: { fontSize: 20, fontWeight: "800", letterSpacing: -0.4 },
  welcomeCopy: { fontSize: 14, lineHeight: 20, marginTop: 4, opacity: 0.75 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  section: { fontSize: 19, fontWeight: "800", letterSpacing: -0.3 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  flex: { flex: 1 },
  orderArt: { width: 50, height: 50, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  orderNumber: { fontSize: 16, fontWeight: "800" },
  meta: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  amount: { fontSize: 18, fontWeight: "800", letterSpacing: -0.4 },
});
