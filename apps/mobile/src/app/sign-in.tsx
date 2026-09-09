import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@/auth/provider";
import { Button, Card, PageHeader, Screen } from "@/components/ui";
import { externalUrls } from "@/config/runtime";
import { useAppTheme } from "@/theme/theme";

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

  return (
    <Screen>
      <PageHeader
        eyebrow="VyapaarMate"
        title="Local business, handled natively"
        subtitle="Secure access for customers and verified business teams on iPhone, iPad, and Android."
      />
      <Card>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Customer</Text>
        <Text style={[styles.copy, { color: colors.textMuted }]}>Browse eligible local businesses, place orders, book in-person services, and track bookings.</Text>
        <Button label="Continue as customer" loading={active === "user"} disabled={active !== null} onPress={() => void signIn("user")} />
      </Card>
      <Card>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Business team</Text>
        <Text style={[styles.copy, { color: colors.textMuted }]}>Owners, managers, kitchen staff, and delivery staff get only their permitted native tools.</Text>
        <Button label="Continue as business" variant="secondary" loading={active === "business"} disabled={active !== null} onPress={() => void signIn("business")} />
      </Card>
      <View style={styles.links}>
        <Button label="Privacy" variant="ghost" onPress={() => void WebBrowser.openBrowserAsync(externalUrls.privacy)} />
        <Button label="Terms" variant="ghost" onPress={() => void WebBrowser.openBrowserAsync(externalUrls.terms)} />
        <Button label="Support" variant="ghost" onPress={() => void WebBrowser.openBrowserAsync(externalUrls.support)} />
        <Button label="Request account deletion by email" variant="ghost" onPress={() => router.push("/account-removal")} />
      </View>
      <Text style={[styles.footnote, { color: colors.textMuted }]}>Administrator and support-agent access is intentionally website-only.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontSize: 20, fontWeight: "800" },
  copy: { fontSize: 15, lineHeight: 22 },
  links: { gap: 4 },
  footnote: { fontSize: 12, lineHeight: 18, textAlign: "center" },
});
