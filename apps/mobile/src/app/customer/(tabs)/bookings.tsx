import { FlatList, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useQuery } from "@tanstack/react-query";
import { getCustomerHome, type Booking } from "@/api/customer";
import { Illustration, illustrationForBusinessType } from "@/components/illustrations";
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
          <View style={[styles.art, { backgroundColor: colors.surfaceMuted, boxShadow: colors.insetShadow }]}>
            <Illustration name={illustrationForBusinessType(item.business.businessType)} size={44} />
          </View>
          <View style={styles.flex}>
            <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>{item.business.name}</Text>
            <View style={[styles.numberChip, { backgroundColor: colors.contrast }]}>
              <Text style={[styles.number, { color: colors.onContrast }]}>{item.orderNumber}</Text>
            </View>
          </View>
        </View>
        <View style={styles.pills}>
          <Pill label={item.status} tone={statusTone(item.status)} />
          <Pill label={`Payment ${item.paymentStatus}`} tone={statusTone(item.paymentStatus)} />
        </View>
        <Text style={[styles.items, { color: colors.text }]}>{item.items.map((line) => `${line.quantity}× ${line.itemName}`).join(", ")}</Text>
        {item.appointment ? (
          <View style={[styles.slotChip, { backgroundColor: colors.accentSurface }]}>
            <Text style={[styles.meta, styles.bold, { color: colors.accent }]}>{formatDateTime(item.appointment.startsAt)} · {item.appointment.provider.name}</Text>
          </View>
        ) : null}
        <View style={[styles.amountBand, { borderTopColor: colors.border }]}>
          <Text style={[styles.meta, { color: colors.textMuted }]}>{formatDateTime(item.createdAt)}</Text>
          <Text style={[styles.amount, { color: colors.text }]}>{formatInr(item.totalAmount)}</Text>
        </View>
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
        ListHeaderComponent={<PageHeader eyebrow="Customer" title="Bookings" subtitle="Orders and in-person appointments update when the app returns to the foreground." illustration="calendar" />}
        ListEmptyComponent={home.isLoading
          ? <LoadingState label="Loading bookings…" />
          : home.isError
            ? <StateView title="Could not load bookings" message={home.error.message} action={<Button label="Try again" onPress={() => void home.refetch()} />} />
            : <StateView title="No bookings yet" message="Your orders and appointments will appear here." illustration="calendar" />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 36, gap: 16 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  flex: { flex: 1, gap: 6, alignItems: "flex-start" },
  art: { width: 62, height: 62, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3, alignSelf: "stretch" },
  numberChip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  number: { fontSize: 11, fontWeight: "800" },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  items: { fontSize: 14, lineHeight: 20 },
  slotChip: { alignSelf: "flex-start", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  meta: { fontSize: 12, lineHeight: 18 },
  bold: { fontWeight: "800" },
  amountBand: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, borderTopWidth: 2, borderStyle: "dashed", paddingTop: 12 },
  amount: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
});
