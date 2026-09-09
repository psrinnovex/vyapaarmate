import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { useQuery } from "@tanstack/react-query";
import { searchBusinesses, type BusinessListing } from "@/api/customer";
import { Button, Card, LoadingState, PageHeader, Pill, Screen, StateView, TextField } from "@/components/ui";
import { useAppTheme } from "@/theme/theme";

type Coordinates = { latitude: number; longitude: number };

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

  function BusinessCard({ item }: { item: BusinessListing }) {
    const distance = coordinates ? distanceKm(coordinates, item) : item.distanceKm;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${item.name}`}
        onPress={() => router.push({ pathname: "/customer/business/[slug]", params: { slug: item.slug } })}
      >
        <Card style={styles.businessCard}>
          <View style={[styles.logo, { backgroundColor: colors.surfaceMuted }]}>
            {item.logoUrl ? <Image source={item.logoUrl} style={{ width: 56, height: 56 }} contentFit="cover" /> : <Text style={[styles.logoText, { color: colors.primary }]}>{item.logoText}</Text>}
          </View>
          <View style={styles.businessCopy}>
            <View style={styles.rowBetween}>
              <Text style={[styles.businessName, { color: colors.text }]}>{item.name}</Text>
              <Pill label={item.open ? "Open" : "Closed"} tone={item.open ? "success" : "neutral"} />
            </View>
            <Text style={[styles.meta, { color: colors.textMuted }]}>{item.businessType} · {item.city}</Text>
            <Text numberOfLines={1} style={[styles.meta, { color: colors.textMuted }]}>{item.featuredItems.join(" · ") || `${item.itemCount} available items`}</Text>
            {Number.isFinite(distance) ? <Text style={[styles.distance, { color: colors.accent }]}>{Number(distance).toFixed(1)} km away</Text> : null}
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
        renderItem={({ item }) => <BusinessCard item={item} />}
        ListHeaderComponent={(
          <View style={styles.header}>
            <PageHeader eyebrow="Customer" title="Find something local" subtitle="Food, retail goods, and in-person services from eligible nearby businesses." />
            <TextField label="Search" placeholder="Business, item, or category" value={draft} onChangeText={setDraft} returnKeyType="search" onSubmitEditing={() => setQuery(draft)} />
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
  content: { padding: 20, paddingBottom: 36, gap: 12 },
  header: { gap: 16, marginBottom: 8 },
  actions: { flexDirection: "row", gap: 10 },
  action: { flex: 1 },
  privacy: { fontSize: 12, lineHeight: 17 },
  businessCard: { flexDirection: "row", alignItems: "center" },
  logo: { width: 62, height: 62, borderRadius: 17, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  logoText: { fontSize: 21, fontWeight: "800" },
  businessCopy: { flex: 1, gap: 5 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  businessName: { flex: 1, fontSize: 17, fontWeight: "800" },
  meta: { fontSize: 13, lineHeight: 18 },
  distance: { fontSize: 12, fontWeight: "700" },
});
