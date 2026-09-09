import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";
import { useAppTheme } from "@/theme/theme";

const icon = (glyph: string, color: ColorValue) => <Text style={{ color, fontSize: 19 }}>{glyph}</Text>;

export default function CustomerTabs() {
  const { colors } = useAppTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontWeight: "700" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Discover", tabBarIcon: ({ color }) => icon("⌕", color) }} />
      <Tabs.Screen name="bookings" options={{ title: "Bookings", tabBarIcon: ({ color }) => icon("▤", color) }} />
      <Tabs.Screen name="settings" options={{ title: "Account", tabBarIcon: ({ color }) => icon("●", color) }} />
    </Tabs>
  );
}
