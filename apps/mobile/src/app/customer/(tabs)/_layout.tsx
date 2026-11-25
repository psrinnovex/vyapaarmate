import { Tabs } from "expo-router";
import { clayTabBarOptions, TabIllustration } from "@/components/tab-bar";
import { useAppTheme } from "@/theme/theme";

export default function CustomerTabs() {
  const { colors } = useAppTheme();
  return (
    <Tabs screenOptions={clayTabBarOptions(colors)}>
      <Tabs.Screen name="index" options={{ title: "Discover", tabBarIcon: ({ focused }) => <TabIllustration name="shop" focused={focused} /> }} />
      <Tabs.Screen name="bookings" options={{ title: "Bookings", tabBarIcon: ({ focused }) => <TabIllustration name="calendar" focused={focused} /> }} />
      <Tabs.Screen name="settings" options={{ title: "Account", tabBarIcon: ({ focused }) => <TabIllustration name="customers" focused={focused} /> }} />
    </Tabs>
  );
}
