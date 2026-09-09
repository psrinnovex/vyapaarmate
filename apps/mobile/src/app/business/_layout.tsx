import { Redirect, Stack } from "expo-router";
import { isBusinessRole } from "@/auth/contracts";
import { useAuth } from "@/auth/provider";
import { LoadingState, Screen } from "@/components/ui";

export default function BusinessLayout() {
  const auth = useAuth();
  if (auth.status === "loading") return <Screen scroll={false}><LoadingState /></Screen>;
  if (auth.status !== "authenticated") return <Redirect href="/sign-in" />;
  if (!isBusinessRole(auth.user.role)) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
