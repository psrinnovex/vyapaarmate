import { useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import { requestDeletionByEmail } from "@/api/account";
import { Button, Card, PageHeader, Screen, TextField, BodyText } from "@/components/ui";

export default function AccountRemovalScreen() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      await requestDeletionByEmail(email);
      Alert.alert(
        "Check your email",
        "If an eligible account exists, VyapaarMate will send a single-use verification link. This response does not reveal whether an account exists.",
        [{ text: "Done", onPress: () => router.back() }],
      );
    } catch (error) {
      Alert.alert("Request not sent", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <PageHeader eyebrow="Account control" title="Request deletion by email" subtitle="Use this if you no longer have a signed-in device." />
      <Card>
        <BodyText>For security, VyapaarMate sends a single-use link to the account email before any deletion or business closure is started.</BodyText>
        <TextField label="Account email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <Button label="Send verification link" loading={submitting} disabled={!email.trim()} onPress={() => void submit()} />
        <Button label="Back" variant="ghost" onPress={() => router.back()} />
      </Card>
    </Screen>
  );
}
