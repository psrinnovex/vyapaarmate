import { useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import * as Location from "expo-location";
import * as WebBrowser from "expo-web-browser";
import { Image } from "expo-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAppointmentAvailability,
  getBusinessDetail,
  getCustomerHome,
  placeOrder,
  type AppointmentSlot,
  type BusinessDetail,
  type PlaceOrderInput,
} from "@/api/customer";
import { Button, Card, Choice, LoadingState, PageHeader, Pill, Screen, StateView, TextField, BodyText } from "@/components/ui";
import { useAppTheme } from "@/theme/theme";
import { formatInr } from "@/utils/format";

type FulfillmentMode = PlaceOrderInput["orderType"];
type Coordinates = { latitude: number; longitude: number };

const fulfillmentLabels: Record<FulfillmentMode, string> = {
  PICKUP: "Pickup",
  DINE_IN: "Dine-in",
  SERVICE_AT_LOCATION: "At my location",
};

function dateInTimeZone(timeZone: string, dayOffset: number) {
  const date = new Date(Date.now() + dayOffset * 24 * 60 * 60_000);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function slotLabel(slot: AppointmentSlot, timeZone: string) {
  return `${new Intl.DateTimeFormat("en-IN", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(slot.startsAt))} · ${slot.providerName}`;
}

export default function CustomerBusinessScreen() {
  const params = useLocalSearchParams<{ slug: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();
  const business = useQuery({ queryKey: ["customer", "business", slug], queryFn: () => getBusinessDetail(slug ?? ""), enabled: Boolean(slug) });
  const home = useQuery({ queryKey: ["customer", "home"], queryFn: getCustomerHome });
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [orderType, setOrderType] = useState<FulfillmentMode | null>(null);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlot | null>(null);
  const idempotencyKey = useRef<string | null>(null);

  const effectiveOrderType = orderType ?? business.data?.fulfillmentModes[0] ?? null;
  const effectiveSelectedDate = selectedDate || (business.data ? dateInTimeZone(business.data.appointmentTimezone, 1) : "");

  const selectedItems = useMemo(
    () => Object.entries(quantities).filter(([, quantity]) => quantity > 0).map(([menuItemId, quantity]) => ({ menuItemId, quantity })),
    [quantities],
  );
  const selectedMenu = useMemo(() => {
    const detail = business.data;
    return detail ? selectedItems.map((item) => ({ ...item, menu: detail.menu.find((entry) => entry.id === item.menuItemId)! })).filter((item) => item.menu) : [];
  }, [business.data, selectedItems]);
  const subtotal = selectedMenu.reduce((sum, item) => sum + item.menu.price * item.quantity, 0);
  const appointmentRequired = Boolean(
    business.data?.appointmentBookingEnabled && selectedMenu.some((item) => item.menu.appointmentEnabled),
  );

  const availability = useQuery({
    queryKey: ["customer", "availability", slug, effectiveSelectedDate, effectiveOrderType, selectedItems],
    queryFn: () => getAppointmentAvailability({
      businessSlug: slug ?? "",
      date: effectiveSelectedDate,
      orderType: effectiveOrderType!,
      items: selectedItems,
    }),
    enabled: Boolean(appointmentRequired && slug && effectiveSelectedDate && effectiveOrderType && selectedItems.length),
  });

  const submitOrder = useMutation({
    mutationFn: async () => {
      const detail = business.data;
      const user = home.data?.user;
      if (!detail || !user || !user.phone || !effectiveOrderType) throw new Error("A verified customer phone number and fulfillment choice are required.");
      if (!idempotencyKey.current) idempotencyKey.current = `native-order-${Crypto.randomUUID()}`;
      return placeOrder({
        businessSlug: detail.slug,
        customer: {
          name: user.name,
          email: user.email,
          phone: user.phone,
          address: address.trim() || undefined,
          latitude: coordinates?.latitude,
          longitude: coordinates?.longitude,
          whatsappOptIn: false,
          marketingOptIn: false,
        },
        orderType: effectiveOrderType,
        notes: notes.trim() || undefined,
        paymentMethod: "PAY_ON_PICKUP_OR_DELIVERY",
        appointment: appointmentRequired && selectedSlot
          ? { providerId: selectedSlot.providerId, startsAt: selectedSlot.startsAt }
          : undefined,
        items: selectedItems,
      }, idempotencyKey.current);
    },
    onSuccess: async (result) => {
      idempotencyKey.current = null;
      await queryClient.invalidateQueries({ queryKey: ["customer", "home"] });
      Alert.alert(result.idempotentReplay ? "Order already received" : "Order received", result.message, [
        { text: "Done", onPress: () => router.replace("/customer/bookings") },
        { text: "Track order", onPress: () => void WebBrowser.openBrowserAsync(result.orderUrl) },
      ]);
    },
    onError: (error) => Alert.alert("Order not placed", error instanceof Error ? error.message : "Please try again. A retry will not create a duplicate order."),
  });

  function invalidateOrder() {
    idempotencyKey.current = null;
  }

  function invalidateOrderAndSlot() {
    invalidateOrder();
    setSelectedSlot(null);
  }

  function setQuantity(id: string, quantity: number) {
    invalidateOrderAndSlot();
    setQuantities((current) => ({ ...current, [id]: Math.max(0, Math.min(20, quantity)) }));
  }

  async function captureLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Location not enabled", "Enter the service address manually. Precise location is required only for service-radius validation.");
      return;
    }
    const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    invalidateOrder();
    setCoordinates({ latitude: result.coords.latitude, longitude: result.coords.longitude });
  }

  if (business.isLoading) return <Screen scroll={false}><LoadingState label="Loading business…" /></Screen>;
  if (business.isError || !business.data) {
    return <Screen scroll={false}><StateView title="Business unavailable" message={business.error?.message ?? "This business is not available in the mobile app."} action={<Button label="Back" onPress={() => router.back()} />} /></Screen>;
  }

  const detail: BusinessDetail = business.data;
  const dates = Array.from({ length: Math.min(7, detail.appointmentMaxAdvanceDays) }, (_, index) => dateInTimeZone(detail.appointmentTimezone, index + 1));
  const minimumMet = subtotal >= detail.minimumOrder;
  const serviceLocationReady = effectiveOrderType !== "SERVICE_AT_LOCATION" || (address.trim().length > 0 && coordinates !== null);
  const ready = selectedItems.length > 0 && Boolean(effectiveOrderType) && minimumMet && serviceLocationReady && detail.allowsPayOnDelivery && (!appointmentRequired || selectedSlot !== null) && Boolean(home.data?.user.phone);

  return (
    <Screen>
      <Button label="Back to businesses" variant="ghost" onPress={() => router.back()} />
      <PageHeader eyebrow={detail.businessType} title={detail.name} subtitle={`${detail.address}, ${detail.city} · ${detail.hours}`} action={<Pill label={detail.open ? "Open" : "Closed"} tone={detail.open ? "success" : "neutral"} />} />
      {detail.logoUrl ? <Image source={detail.logoUrl} style={styles.heroImage} contentFit="cover" /> : null}

      <Card>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Choose items or services</Text>
        {detail.menu.filter((item) => item.isAvailable).map((item) => {
          const quantity = quantities[item.id] ?? 0;
          return (
            <View key={item.id} style={[styles.menuRow, { borderBottomColor: colors.border }]}>
              <View style={styles.flex}>
                <View style={styles.inline}>
                  <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
                  {item.isBestSeller ? <Pill label="Popular" tone="success" /> : null}
                </View>
                <Text style={[styles.meta, { color: colors.textMuted }]}>{item.category}{item.description ? ` · ${item.description}` : ""}</Text>
                <Text style={[styles.price, { color: colors.text }]}>{formatInr(item.price)}{item.appointmentEnabled ? ` · ${item.durationMinutes} min` : ""}</Text>
              </View>
              <View style={styles.counter}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove one ${item.name}`} onPress={() => setQuantity(item.id, quantity - 1)} style={[styles.counterButton, { borderColor: colors.border }]}><Text style={[styles.counterText, { color: colors.text }]}>−</Text></Pressable>
                <Text accessibilityLabel={`${quantity} selected`} style={[styles.quantity, { color: colors.text }]}>{quantity}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={`Add one ${item.name}`} onPress={() => setQuantity(item.id, quantity + 1)} style={[styles.counterButton, { borderColor: colors.border }]}><Text style={[styles.counterText, { color: colors.text }]}>+</Text></Pressable>
              </View>
            </View>
          );
        })}
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Fulfillment</Text>
        <View style={styles.choices}>
          {detail.fulfillmentModes.map((mode) => <Choice key={mode} label={fulfillmentLabels[mode]} selected={effectiveOrderType === mode} onPress={() => { invalidateOrderAndSlot(); setOrderType(mode); }} />)}
        </View>
        {effectiveOrderType === "SERVICE_AT_LOCATION" ? (
          <>
            <TextField label="Service address" value={address} onChangeText={(value) => { invalidateOrder(); setAddress(value); }} maxLength={300} multiline />
            <Button label={coordinates ? "Location confirmed" : "Confirm precise location"} variant="secondary" onPress={() => void captureLocation()} />
            <BodyText muted>Your location is sent only with this service request for radius and fulfillment. It is not used for advertising.</BodyText>
          </>
        ) : null}
        <TextField label="Note (optional)" value={notes} onChangeText={(value) => { invalidateOrder(); setNotes(value); }} maxLength={500} multiline />
      </Card>

      {appointmentRequired ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Choose appointment</Text>
          <BodyText muted>Times are shown in {detail.appointmentTimezone}.</BodyText>
          <View style={styles.choices}>
            {dates.map((date) => <Choice key={date} label={date} selected={effectiveSelectedDate === date} onPress={() => { invalidateOrderAndSlot(); setSelectedDate(date); }} />)}
          </View>
          {availability.isLoading ? <LoadingState label="Finding times…" /> : availability.isError ? <StateView title="Times unavailable" message={availability.error.message} action={<Button label="Try again" onPress={() => void availability.refetch()} />} /> : availability.data?.slots.length ? (
            <View style={styles.choices}>
              {availability.data.slots.slice(0, 12).map((slot) => <Choice key={`${slot.providerId}-${slot.startsAt}`} label={slotLabel(slot, detail.appointmentTimezone)} selected={selectedSlot?.providerId === slot.providerId && selectedSlot.startsAt === slot.startsAt} onPress={() => { idempotencyKey.current = null; setSelectedSlot(slot); }} />)}
            </View>
          ) : <BodyText muted>No available times on this date.</BodyText>}
        </Card>
      ) : null}

      <Card>
        <View style={styles.rowBetween}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Total</Text>
          <Text style={[styles.total, { color: colors.text }]}>{formatInr(subtotal)}</Text>
        </View>
        {detail.minimumOrder > 0 && !minimumMet ? <BodyText muted>Minimum request value is {formatInr(detail.minimumOrder)}.</BodyText> : null}
        {!detail.allowsPayOnDelivery ? <BodyText muted>This business does not currently accept payment at fulfillment, so native checkout is unavailable. No website purchase link is presented inside the business app area.</BodyText> : <BodyText muted>Pay the business at pickup, dine-in, or service completion. Online payment is not offered in this mobile release.</BodyText>}
        {!home.data?.user.phone ? <BodyText muted>Add and verify a phone number on the website before placing a request.</BodyText> : null}
        <Button label="Place request" loading={submitOrder.isPending} disabled={!ready || submitOrder.isPending} onPress={() => submitOrder.mutate()} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroImage: { width: "100%", height: 180, borderRadius: 20 },
  sectionTitle: { fontSize: 19, fontWeight: "800" },
  menuRow: { flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1 },
  inline: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemName: { flex: 1, fontSize: 16, fontWeight: "800" },
  meta: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  price: { fontSize: 14, fontWeight: "700", marginTop: 5 },
  counter: { flexDirection: "row", alignItems: "center", gap: 9 },
  counterButton: { width: 38, height: 38, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  counterText: { fontSize: 22, fontWeight: "700" },
  quantity: { minWidth: 20, textAlign: "center", fontWeight: "800" },
  choices: { gap: 8 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  total: { fontSize: 24, fontWeight: "800" },
});
