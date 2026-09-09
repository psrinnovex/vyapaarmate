import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import { useQuery } from "@tanstack/react-query";
import {
  deleteCurrentAccount,
  getAccountSession,
  getCustomerDataExport,
  revokeAllSessions,
} from "@/api/account";
import { useAuth } from "@/auth/provider";
import { Button, Card, LoadingState, PageHeader, Pill, Screen, StateView, TextField, BodyText } from "@/components/ui";
import { externalUrls } from "@/config/runtime";
import { useAppTheme } from "@/theme/theme";
import { formatDateTime } from "@/utils/format";

export function AccountScreen() {
  const auth = useAuth();
  const { colors } = useAppTheme();
  const account = useQuery({ queryKey: ["account", "session"], queryFn: getAccountSession });
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"revoke" | "delete" | "export" | null>(null);

  if (auth.status !== "authenticated") return null;
  const role = auth.user.role;
  const isOwner = role === "OWNER";
  const deletePhrase = isOwner ? "DELETE MY BUSINESS ACCOUNT" : "DELETE MY ACCOUNT";

  async function exportData() {
    setBusy("export");
    let path: string | null = null;
    try {
      const payload = await getCustomerDataExport();
      path = `${FileSystem.cacheDirectory}vyapaarmate-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      await FileSystem.writeAsStringAsync(path, JSON.stringify(payload, null, 2));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: "application/json", dialogTitle: "Save VyapaarMate data export" });
      } else {
        Alert.alert("Export saved", path);
      }
    } catch (error) {
      Alert.alert("Export unavailable", error instanceof Error ? error.message : "Please try again.");
    } finally {
      if (path) await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => undefined);
      setBusy(null);
    }
  }

  async function revokeOtherSessions() {
    if (!password) return;
    setBusy("revoke");
    try {
      const result = await revokeAllSessions(password);
      Alert.alert("Other sessions signed out", `${result.sessionCount} other mobile session${result.sessionCount === 1 ? "" : "s"} revoked.`);
      setPassword("");
    } catch (error) {
      Alert.alert("Could not revoke sessions", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  function confirmDeletion() {
    if (!password || confirmation !== deletePhrase) return;
    Alert.alert(
      isOwner ? "Schedule permanent business deletion?" : "Permanently delete this account?",
      isOwner
        ? "The business will be frozen immediately and permanently processed after the disclosed 30-day period."
        : "Your sign-in identity will be removed now. Records with a documented retention basis are de-identified and retained only for that purpose.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isOwner ? "Freeze and schedule" : "Delete permanently",
          style: "destructive",
          onPress: () => void executeDeletion(),
        },
      ],
    );
  }

  async function executeDeletion() {
    setBusy("delete");
    try {
      await deleteCurrentAccount({ role, currentPassword: password, reason });
      await auth.forgetSession();
      Alert.alert(
        isOwner ? "Business deletion scheduled" : "Account deleted",
        isOwner
          ? "The business is frozen and scheduled for permanent processing."
          : "This device is signed out and the account deletion completed.",
        [{ text: "Done", onPress: () => router.replace("/sign-in") }],
      );
    } catch (error) {
      Alert.alert("Deletion did not complete", error instanceof Error ? error.message : "No partial deletion was completed. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <PageHeader eyebrow="Account" title="Security and privacy" subtitle="Control this device session, export customer data, or permanently remove the account." />

      {account.isLoading ? <LoadingState label="Loading account…" /> : account.isError ? (
        <StateView title="Could not load account" message={account.error.message} action={<Button label="Try again" onPress={() => void account.refetch()} />} />
      ) : account.data ? (
        <Card>
          <View style={styles.rowBetween}>
            <View style={styles.flex}>
              <Text style={[styles.name, { color: colors.text }]}>{account.data.user.name}</Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>{account.data.user.email}</Text>
            </View>
            <Pill label={account.data.user.role} tone="success" />
          </View>
          <BodyText muted>Current device: {account.data.session.platform} · session expires by {formatDateTime(account.data.session.absoluteExpiresAt)}</BodyText>
          {account.data.accountDeletion ? <Pill label={`Deletion ${account.data.accountDeletion.status}`} tone="warning" /> : null}
        </Card>
      ) : null}

      {role === "CUSTOMER" ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Your data</Text>
          <BodyText muted>Generate a JSON copy of the customer profile, orders, appointments, and related account information available to you.</BodyText>
          <Button label="Export my data" variant="secondary" loading={busy === "export"} disabled={busy !== null} onPress={() => void exportData()} />
        </Card>
      ) : null}

      <Card>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Sign out other devices</Text>
        <BodyText muted>Enter your current password. This device stays signed in; other active mobile sessions are revoked.</BodyText>
        <TextField label="Current password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" />
        <Button label="Sign out other devices" variant="secondary" loading={busy === "revoke"} disabled={busy !== null || !password} onPress={() => void revokeOtherSessions()} />
      </Card>

      <Card style={{ borderColor: colors.danger }}>
        <Text style={[styles.sectionTitle, { color: colors.danger }]}>{isOwner ? "Delete business account" : "Delete account"}</Text>
        <BodyText muted>
          {isOwner
            ? "This freezes commerce, integrations, subscription access, and team sessions immediately. Permanent processing starts after 30 days."
            : "This permanently removes the sign-in identity and personal fields that have no approved retention purpose."}
        </BodyText>
        {isOwner ? <TextField label="Reason (optional)" value={reason} onChangeText={setReason} maxLength={500} multiline /> : null}
        <TextField label="Current password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" />
        <TextField label={`Type ${deletePhrase}`} value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" autoCorrect={false} />
        <Button label={isOwner ? "Freeze and schedule deletion" : "Permanently delete account"} variant="danger" loading={busy === "delete"} disabled={busy !== null || !password || confirmation !== deletePhrase} onPress={confirmDeletion} />
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Help and legal</Text>
        <Button label="Privacy notice" variant="ghost" onPress={() => void WebBrowser.openBrowserAsync(externalUrls.privacy)} />
        <Button label="Terms" variant="ghost" onPress={() => void WebBrowser.openBrowserAsync(externalUrls.terms)} />
        <Button label="Support" variant="ghost" onPress={() => void WebBrowser.openBrowserAsync(externalUrls.support)} />
      </Card>

      <Button label="Sign out on this device" variant="secondary" onPress={() => void auth.signOut().then(() => router.replace("/sign-in"))} />
      {role !== "CUSTOMER" ? <BodyText muted>Business subscription signup, purchase, renewal, and pricing are intentionally not offered in the mobile app.</BodyText> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  flex: { flex: 1 },
  name: { fontSize: 19, fontWeight: "800" },
  meta: { fontSize: 13, marginTop: 4 },
  sectionTitle: { fontSize: 19, fontWeight: "800" },
});
