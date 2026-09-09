import { Alert, FlatList, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getBusinessAppointments, updateAppointmentStatus, type BusinessAppointment } from "@/api/business";
import { Button, Card, LoadingState, PageHeader, Pill, Screen, StateView } from "@/components/ui";
import { useAppTheme } from "@/theme/theme";
import { formatDateTime, formatInr, statusTone } from "@/utils/format";

const nextStatuses: Record<BusinessAppointment["status"], BusinessAppointment["status"][]> = {
  REQUESTED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export default function BusinessAppointmentsScreen() {
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();
  const appointments = useQuery({ queryKey: ["business", "appointments"], queryFn: getBusinessAppointments, refetchOnWindowFocus: true });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: BusinessAppointment["status"] }) => updateAppointmentStatus(id, status),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["business", "appointments"] }),
    onError: (error) => Alert.alert("Booking not updated", error instanceof Error ? error.message : "Please try again."),
  });

  function AppointmentCard({ item }: { item: BusinessAppointment }) {
    return (
      <Card>
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <Text style={[styles.customer, { color: colors.text }]}>{item.customer.name}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>{item.customer.phone} · {item.order.orderNumber}</Text>
          </View>
          <Pill label={item.status} tone={statusTone(item.status)} />
        </View>
        <Text style={[styles.time, { color: colors.accent }]}>{formatDateTime(item.startsAt)} – {formatDateTime(item.endsAt)}</Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>{item.provider.name} · {item.provider.title}</Text>
        <Text style={[styles.items, { color: colors.text }]}>{item.order.items.map((line) => `${line.quantity}× ${line.itemName}`).join(", ")}</Text>
        <Text style={[styles.amount, { color: colors.text }]}>{formatInr(item.order.totalAmount)}</Text>
        <View style={styles.actions}>
          {nextStatuses[item.status].map((status) => (
            <View key={status} style={styles.action}>
              <Button label={status.replaceAll("_", " ")} variant={status === "CANCELLED" || status === "NO_SHOW" ? "danger" : "secondary"} disabled={update.isPending} onPress={() => update.mutate({ id: item.id, status })} />
            </View>
          ))}
        </View>
      </Card>
    );
  }

  const unsupported = appointments.data && !appointments.data.business.supported;
  return (
    <Screen scroll={false}>
      <FlatList
        data={unsupported ? [] : appointments.data?.appointments ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshing={appointments.isRefetching}
        onRefresh={() => void appointments.refetch()}
        renderItem={({ item }) => <AppointmentCard item={item} />}
        ListHeaderComponent={<PageHeader eyebrow="Operations" title="Bookings" subtitle="In-person appointment status and assigned professional." />}
        ListEmptyComponent={appointments.isLoading ? <LoadingState label="Loading bookings…" /> : appointments.isError ? <StateView title="Could not load bookings" message={appointments.error.message} action={<Button label="Try again" onPress={() => void appointments.refetch()} />} /> : unsupported ? <StateView title="Appointments not used here" message="This business category does not use appointment scheduling." /> : <StateView title="No appointments" message="Pull down to check again." />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 36, gap: 12 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  flex: { flex: 1 },
  customer: { fontSize: 17, fontWeight: "800" },
  meta: { fontSize: 12, lineHeight: 18 },
  time: { fontSize: 14, fontWeight: "700" },
  items: { fontSize: 14, lineHeight: 20 },
  amount: { fontSize: 17, fontWeight: "800" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: { minWidth: 120, flexGrow: 1 },
});
