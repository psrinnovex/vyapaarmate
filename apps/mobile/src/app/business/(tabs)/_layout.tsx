import { Tabs } from "expo-router";
import { clayTabBarOptions, TabIllustration } from "@/components/tab-bar";
import { useAppTheme } from "@/theme/theme";

export default function BusinessTabs() {
  const { colors } = useAppTheme();
  return (
    <Tabs screenOptions={clayTabBarOptions(colors)}>
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ focused }) => <TabIllustration name="chart" focused={focused} /> }} />
      <Tabs.Screen name="orders" options={{ title: "Orders", tabBarIcon: ({ focused }) => <TabIllustration name="bag" focused={focused} /> }} />
      <Tabs.Screen name="appointments" options={{ title: "Bookings", tabBarIcon: ({ focused }) => <TabIllustration name="calendar" focused={focused} /> }} />
      <Tabs.Screen name="settings" options={{ title: "Account", tabBarIcon: ({ focused }) => <TabIllustration name="shield" focused={focused} /> }} />
    </Tabs>
  );
}
