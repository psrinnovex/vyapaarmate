import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";
import { useAppTheme } from "@/theme/theme";

const icon = (glyph: string, color: ColorValue) => <Text style={{ color, fontSize: 18 }}>{glyph}</Text>;

export default function BusinessTabs() {
  const { colors } = useAppTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontWeight: "700", fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color }) => icon("⌂", color) }} />
      <Tabs.Screen name="orders" options={{ title: "Orders", tabBarIcon: ({ color }) => icon("▤", color) }} />
      <Tabs.Screen name="appointments" options={{ title: "Bookings", tabBarIcon: ({ color }) => icon("◷", color) }} />
      <Tabs.Screen name="settings" options={{ title: "Account", tabBarIcon: ({ color }) => icon("●", color) }} />
    </Tabs>
  );
}
