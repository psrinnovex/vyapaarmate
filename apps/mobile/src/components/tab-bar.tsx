import { StyleSheet, View } from "react-native";
import { Illustration, type IllustrationName } from "@/components/illustrations";
import type { AppColors } from "@/theme/theme";

/** Picture tab icon: full colour and a little larger when focused, faded when not. */
export function TabIllustration({ name, focused }: { name: IllustrationName; focused: boolean }) {
  return (
    <View style={[styles.icon, { opacity: focused ? 1 : 0.5, transform: [{ scale: focused ? 1.12 : 1 }, { translateY: focused ? -2 : 0 }] }]}>
      <Illustration name={name} size={30} />
    </View>
  );
}

/** Rounded clay tab bar shared by the customer and business tab layouts. */
export function clayTabBarOptions(colors: AppColors) {
  return {
    headerShown: false,
    tabBarActiveTintColor: colors.text,
    tabBarInactiveTintColor: colors.textMuted,
    tabBarStyle: {
      backgroundColor: colors.surface,
      borderTopWidth: 0,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingTop: 6,
      boxShadow: "0px -10px 30px -18px rgba(55, 41, 130, 0.45)",
    },
    tabBarLabelStyle: { fontWeight: "800" as const, fontSize: 11 },
  };
}

const styles = StyleSheet.create({
  icon: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
});
