import { Redirect } from "expo-router";
import { useAuth } from "@/auth/provider";
import { isBusinessRole } from "@/auth/contracts";
import { Button, LoadingState, Screen, StateView } from "@/components/ui";

export default function Index() {
  const auth = useAuth();
  if (auth.status === "loading") return <Screen scroll={false}><LoadingState label="Restoring your secure session…" /></Screen>;
  if (auth.status === "recoverable-error") {
    return (
      <Screen scroll={false}>
        <StateView
          title="Session could not be restored"
          message={`${auth.error} Your stored sign-in has not been discarded.`}
          action={<Button label="Try again" onPress={() => void auth.retryRestore()} />}
        />
      </Screen>
    );
  }
  if (auth.status !== "authenticated") return <Redirect href="/sign-in" />;
  return auth.user.role === "CUSTOMER"
    ? <Redirect href="/customer" />
    : isBusinessRole(auth.user.role)
      ? <Redirect href="/business" />
      : <Redirect href="/sign-in" />;
}
