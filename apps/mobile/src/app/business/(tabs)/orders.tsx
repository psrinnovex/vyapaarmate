import { Alert, FlatList, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getBusinessOrders, updateOrderStatus, type LiveOrder } from "@/api/business";
import { Button, Card, LoadingState, PageHeader, Pill, Screen, StateView } from "@/components/ui";
import { useAppTheme } from "@/theme/theme";
import { formatDateTime, formatInr, statusTone } from "@/utils/format";

const nextStatuses: Record<LiveOrder["status"], LiveOrder["status"][]> = {
  NEW: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export default function BusinessOrdersScreen() {
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();
  const orders = useQuery({ queryKey: ["business", "orders"], queryFn: getBusinessOrders, refetchOnWindowFocus: true });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LiveOrder["status"] }) => updateOrderStatus(id, status),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["business", "orders"] }),
        queryClient.invalidateQueries({ queryKey: ["business", "home"] }),
      ]);
    },
    onError: (error) => Alert.alert("Status not updated", error instanceof Error ? error.message : "Please try again."),
  });

  function changeStatus(order: LiveOrder, status: LiveOrder["status"]) {
    if (status !== "CANCELLED") {
      update.mutate({ id: order.id, status });
      return;
    }
    Alert.alert("Cancel this order?", `${order.orderNumber} will be marked cancelled.`, [
      { text: "Keep order", style: "cancel" },
      { text: "Cancel order", style: "destructive", onPress: () => update.mutate({ id: order.id, status }) },
    ]);
  }

  function OrderCard({ item }: { item: LiveOrder }) {
    return (
      <Card>
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <Text style={[styles.number, { color: colors.text }]}>{item.orderNumber}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>{item.customer} · {item.customerPhone}</Text>
          </View>
          <Pill label={item.status} tone={statusTone(item.status)} />
        </View>
        <Text style={[styles.items, { color: colors.text }]}>{item.items}</Text>
        {item.notes ? <Text style={[styles.notes, { color: colors.textMuted }]}>Note: {item.notes}</Text> : null}
        <View style={styles.rowBetween}>
          <Text style={[styles.meta, { color: colors.textMuted }]}>{formatDateTime(item.createdAt)}</Text>
          <Text style={[styles.amount, { color: colors.text }]}>{formatInr(item.amount)}</Text>
        </View>
        <View style={styles.actions}>
          {nextStatuses[item.status].map((status) => (
            <View key={status} style={styles.action}>
              <Button label={status.replaceAll("_", " ")} variant={status === "CANCELLED" ? "danger" : "secondary"} disabled={update.isPending} onPress={() => changeStatus(item, status)} />
            </View>
          ))}
        </View>
      </Card>
    );
  }

  return (
    <Screen scroll={false}>
      <FlatList
        data={orders.data?.orders ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshing={orders.isRefetching}
        onRefresh={() => void orders.refetch()}
        renderItem={({ item }) => <OrderCard item={item} />}
        ListHeaderComponent={<PageHeader eyebrow="Operations" title="Orders" subtitle="Only status changes permitted for your role are accepted by the server." />}
        ListEmptyComponent={orders.isLoading ? <LoadingState label="Loading orders…" /> : orders.isError ? <StateView title="Could not load orders" message={orders.error.message} action={<Button label="Try again" onPress={() => void orders.refetch()} />} /> : <StateView title="No active orders" message="Pull down to check again." />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 36, gap: 12 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  flex: { flex: 1 },
  number: { fontSize: 17, fontWeight: "800" },
  meta: { fontSize: 12, lineHeight: 18 },
  items: { fontSize: 14, lineHeight: 20 },
  notes: { fontSize: 13, lineHeight: 19 },
  amount: { fontSize: 17, fontWeight: "800" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: { minWidth: 120, flexGrow: 1 },
});
