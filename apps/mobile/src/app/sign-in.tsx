import { useState, type ReactNode } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@/auth/provider";
import { Illustration, type IllustrationName } from "@/components/illustrations";
import { Button, Card, PageHeader, Screen } from "@/components/ui";
import { externalUrls } from "@/config/runtime";
import { useAppTheme } from "@/theme/theme";

function PortalCard({
  art,
  title,
  copy,
  action,
}: {
  art: IllustrationName;
  title: string;
  copy: string;
  action: ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <Card>
      <View style={styles.portalRow}>
        <View style={[styles.portalArt, { backgroundColor: colors.surfaceMuted, boxShadow: colors.insetShadow }]}>
          <Illustration name={art} size={58} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.copy, { color: colors.textMuted }]}>{copy}</Text>
        </View>
      </View>
      {action}
    </Card>
  );
}

export default function SignInScreen() {
  const auth = useAuth();
  const { colors } = useAppTheme();
  const [active, setActive] = useState<"user" | "business" | null>(null);

  async function signIn(portal: "user" | "business") {
    setActive(portal);
    try {
      await auth.signIn(portal);
      router.replace("/");
    } catch (error) {
      Alert.alert("Sign-in did not finish", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setActive(null);
    }
  }

  const links = [
    { label: "Privacy", onPress: () => void WebBrowser.openBrowserAsync(externalUrls.privacy) },
    { label: "Terms", onPress: () => void WebBrowser.openBrowserAsync(externalUrls.terms) },
    { label: "Support", onPress: () => void WebBrowser.openBrowserAsync(externalUrls.support) },
    { label: "Request account deletion by email", onPress: () => router.push("/account-removal") },
  ];

  return (
    <Screen>
      <PageHeader
        eyebrow="VyapaarMate"
        title="Local business, handled natively"
        subtitle="Secure access for customers and verified business teams on iPhone, iPad, and Android."
        illustration="shop"
      />
      <PortalCard
        art="customers"
        title="Customer"
        copy="Browse eligible local businesses, place orders, book in-person services, and track bookings."
        action={<Button label="Continue as customer" loading={active === "user"} disabled={active !== null} onPress={() => void signIn("user")} />}
      />
      <PortalCard
        art="chart"
        title="Business team"
        copy="Owners, managers, kitchen staff, and delivery staff get only their permitted native tools."
        action={<Button label="Continue as business" variant="dark" loading={active === "business"} disabled={active !== null} onPress={() => void signIn("business")} />}
      />
      <View style={styles.links}>
        {links.map((link) => (
          <Pressable
            key={link.label}
            accessibilityRole="button"
            accessibilityLabel={link.label}
            onPress={link.onPress}
            style={({ pressed }) => [styles.linkChip, { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, boxShadow: colors.clayShadowSmall }]}
          >
            <Text style={[styles.linkText, { color: colors.text }]}>{link.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.footnote, { color: colors.textMuted }]}>Administrator and support-agent access is intentionally website-only.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 4 },
  portalRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  portalArt: { width: 76, height: 76, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 20, fontWeight: "800", letterSpacing: -0.4 },
  copy: { fontSize: 14, lineHeight: 20 },
  links: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  linkChip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  linkText: { fontSize: 13, fontWeight: "800" },
  footnote: { fontSize: 12, lineHeight: 18, textAlign: "center" },
});
