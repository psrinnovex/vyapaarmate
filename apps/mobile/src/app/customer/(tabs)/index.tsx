import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { useQuery } from "@tanstack/react-query";
import { searchBusinesses, type BusinessListing } from "@/api/customer";
import { Illustration, illustrationForBusinessType, type IllustrationName } from "@/components/illustrations";
import { Button, Card, LoadingState, PageHeader, Pill, Screen, StateView, TextField } from "@/components/ui";
import { useAppTheme } from "@/theme/theme";

type Coordinates = { latitude: number; longitude: number };

const quickSearches: { label: string; term: string; art: IllustrationName }[] = [
  { label: "All", term: "", art: "shop" },
  { label: "Tiffin", term: "tiffin", art: "tiffin" },
  { label: "Restaurants", term: "restaurant", art: "bowl" },
  { label: "Bakery", term: "bakery", art: "cake" },
  { label: "Salon", term: "salon", art: "salon" },
  { label: "Grocery", term: "grocery", art: "grocery" },
];

/** Stripe colours for each card's storefront awning. */
const awningColors = ["#12B76A", "#7C5CFF", "#FF5C8A", "#FFAD1F", "#33B5F5", "#4F5BD5"];

function distanceKm(from: Coordinates, item: BusinessListing) {
  if (item.latitude === null || item.longitude === null) return Number.POSITIVE_INFINITY;
  const radians = (value: number) => value * Math.PI / 180;
  const latDelta = radians(item.latitude - from.latitude);
  const lonDelta = radians(item.longitude - from.longitude);
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(item.latitude)) * Math.sin(lonDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function CustomerHomeScreen() {
  const { colors } = useAppTheme();
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const businesses = useQuery({ queryKey: ["customer", "businesses", query], queryFn: () => searchBusinesses(query) });
  const rows = useMemo(() => {
    const items = businesses.data?.businesses ?? [];
    return coordinates ? [...items].sort((left, right) => distanceKm(coordinates, left) - distanceKm(coordinates, right)) : items;
  }, [businesses.data, coordinates]);

  async function requestCurrentLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Location not enabled", "You can still browse and search without sharing your location.");
      return;
    }
    const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setCoordinates({ latitude: result.coords.latitude, longitude: result.coords.longitude });
  }

  function BusinessCard({ item, index }: { item: BusinessListing; index: number }) {
    const distance = coordinates ? distanceKm(coordinates, item) : item.distanceKm;
    const awning = awningColors[index % awningColors.length];
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${item.name}`}
        onPress={() => router.push({ pathname: "/customer/business/[slug]", params: { slug: item.slug } })}
        style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
      >
        <Card style={styles.storeCard}>
          <View style={styles.awning}>
            {Array.from({ length: 14 }, (_, stripe) => (
              <View key={stripe} style={[styles.stripe, { backgroundColor: stripe % 2 === 0 ? awning : colors.surface }]} />
            ))}
          </View>
          <View style={[styles.storeFront, { backgroundColor: colors.surfaceMuted }]}>
            <View style={[styles.logo, { backgroundColor: colors.surface, boxShadow: colors.clayShadowSmall }]}>
              {item.logoUrl ? <Image source={item.logoUrl} style={styles.logoImage} contentFit="cover" /> : <Text style={[styles.logoText, { color: awning }]}>{item.logoText}</Text>}
            </View>
            <Illustration name={illustrationForBusinessType(item.businessType)} size={78} />
          </View>
          <View style={styles.businessCopy}>
            <View style={styles.rowBetween}>
              <Text numberOfLines={1} style={[styles.businessName, { color: colors.text }]}>{item.name}</Text>
              <Pill label={item.open ? "Open" : "Closed"} tone={item.open ? "success" : "neutral"} />
            </View>
            <Text style={[styles.meta, { color: colors.accent }]}>{item.businessType} · {item.city}</Text>
            <Text numberOfLines={1} style={[styles.meta, { color: colors.textMuted }]}>{item.featuredItems.join(" · ") || `${item.itemCount} available items`}</Text>
            {Number.isFinite(distance) ? (
              <View style={[styles.distanceChip, { backgroundColor: colors.mangoSurface }]}>
                <Text style={[styles.distance, { color: colors.warning }]}>{Number(distance).toFixed(1)} km away</Text>
              </View>
            ) : null}
          </View>
        </Card>
      </Pressable>
    );
  }

  return (
    <Screen scroll={false}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshing={businesses.isRefetching}
        onRefresh={() => void businesses.refetch()}
        renderItem={({ item, index }) => <BusinessCard item={item} index={index} />}
        ListHeaderComponent={(
          <View style={styles.header}>
            <PageHeader eyebrow="Customer" title="Find something local" subtitle="Food, retail goods, and in-person services from eligible nearby businesses." illustration="shop" />
            <TextField label="Search" placeholder="Business, item, or category" value={draft} onChangeText={setDraft} returnKeyType="search" onSubmitEditing={() => setQuery(draft)} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
              {quickSearches.map((option) => {
                const selected = query === option.term;
                return (
                  <Pressable
                    key={option.label}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Show ${option.label}`}
                    onPress={() => {
                      setDraft(option.term);
                      setQuery(option.term);
                    }}
                    style={[styles.quickChip, { backgroundColor: selected ? colors.contrast : colors.surface, boxShadow: colors.clayShadowSmall }]}
                  >
                    <Illustration name={option.art} size={26} />
                    <Text style={[styles.quickText, { color: selected ? colors.onContrast : colors.text }]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.actions}>
              <View style={styles.action}><Button label="Search" onPress={() => setQuery(draft)} /></View>
              <View style={styles.action}><Button label={coordinates ? "Nearby on" : "Sort nearby"} variant="secondary" onPress={() => void requestCurrentLocation()} /></View>
            </View>
            {coordinates ? <Text style={[styles.privacy, { color: colors.textMuted }]}>Location is used in memory for this screen only and is not stored by the app.</Text> : null}
          </View>
        )}
        ListEmptyComponent={businesses.isLoading
          ? <LoadingState label="Finding businesses…" />
          : businesses.isError
            ? <StateView title="Could not load businesses" message={businesses.error.message} action={<Button label="Try again" onPress={() => void businesses.refetch()} />} />
            : <StateView title="No matching businesses" message="Try another search term." />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 36, gap: 16 },
  header: { gap: 16, marginBottom: 8 },
  actions: { flexDirection: "row", gap: 10 },
  action: { flex: 1 },
  privacy: { fontSize: 12, lineHeight: 17 },
  quickRow: { gap: 8, paddingVertical: 4, paddingRight: 8 },
  quickChip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingLeft: 6, paddingRight: 14, paddingVertical: 6 },
  quickText: { fontSize: 13, fontWeight: "800" },
  storeCard: { padding: 0, gap: 0 },
  awning: { flexDirection: "row", height: 18, borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: "hidden" },
  stripe: { flex: 1, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 },
  storeFront: { height: 96, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 6 },
  logo: { width: 62, height: 62, borderRadius: 20, alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: -22, borderWidth: 3, borderColor: "#FFFFFF" },
  logoImage: { width: 56, height: 56 },
  logoText: { fontSize: 21, fontWeight: "900" },
  businessCopy: { gap: 5, padding: 16, paddingTop: 28 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  businessName: { flex: 1, fontSize: 18, fontWeight: "900", letterSpacing: -0.3 },
  meta: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  distanceChip: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 2 },
  distance: { fontSize: 12, fontWeight: "800" },
});
