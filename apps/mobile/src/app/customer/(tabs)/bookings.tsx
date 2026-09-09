import { FlatList, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useQuery } from "@tanstack/react-query";
import { getCustomerHome, type Booking } from "@/api/customer";
import { Button, Card, LoadingState, PageHeader, Pill, Screen, StateView } from "@/components/ui";
import { API_ORIGIN } from "@/config/runtime";
import { useAppTheme } from "@/theme/theme";
import { formatDateTime, formatInr, statusTone } from "@/utils/format";

export default function BookingsScreen() {
  const { colors } = useAppTheme();
  const home = useQuery({ queryKey: ["customer", "home"], queryFn: getCustomerHome, refetchOnWindowFocus: true });

  function BookingCard({ item }: { item: Booking }) {
    return (
      <Card>
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <Text style={[styles.name, { color: colors.text }]}>{item.business.name}</Text>
            <Text style={[styles.number, { color: colors.textMuted }]}>{item.orderNumber}</Text>
          </View>
          <Pill label={item.status} tone={statusTone(item.status)} />
        </View>
        <Text style={[styles.items, { color: colors.text }]}>{item.items.map((line) => `${line.quantity}× ${line.itemName}`).join(", ")}</Text>
        {item.appointment ? <Text style={[styles.meta, { color: colors.accent }]}>{formatDateTime(item.appointment.startsAt)} · {item.appointment.provider.name}</Text> : null}
        <View style={styles.rowBetween}>
          <Text style={[styles.meta, { color: colors.textMuted }]}>{formatDateTime(item.createdAt)}</Text>
          <Text style={[styles.amount, { color: colors.text }]}>{formatInr(item.totalAmount)}</Text>
        </View>
        <Pill label={`Payment ${item.paymentStatus}`} tone={statusTone(item.paymentStatus)} />
        <Button label="View tracking and invoice" variant="secondary" onPress={() => void WebBrowser.openBrowserAsync(`${API_ORIGIN}/order/${encodeURIComponent(item.publicToken)}`)} />
      </Card>
    );
  }

  return (
    <Screen scroll={false}>
      <FlatList
        data={home.data?.bookings ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshing={home.isRefetching}
        onRefresh={() => void home.refetch()}
        renderItem={({ item }) => <BookingCard item={item} />}
        ListHeaderComponent={<PageHeader eyebrow="Customer" title="Bookings" subtitle="Orders and in-person appointments update when the app returns to the foreground." />}
        ListEmptyComponent={home.isLoading
          ? <LoadingState label="Loading bookings…" />
          : home.isError
            ? <StateView title="Could not load bookings" message={home.error.message} action={<Button label="Try again" onPress={() => void home.refetch()} />} />
            : <StateView title="No bookings yet" message="Your orders and appointments will appear here." />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 36, gap: 12 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  flex: { flex: 1 },
  name: { fontSize: 17, fontWeight: "800" },
  number: { fontSize: 12, marginTop: 3 },
  items: { fontSize: 14, lineHeight: 20 },
  meta: { fontSize: 12, lineHeight: 18 },
  amount: { fontSize: 16, fontWeight: "800" },
});
