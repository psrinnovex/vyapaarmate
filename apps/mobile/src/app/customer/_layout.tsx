import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/auth/provider";
import { LoadingState, Screen } from "@/components/ui";

export default function CustomerLayout() {
  const auth = useAuth();
  if (auth.status === "loading") return <Screen scroll={false}><LoadingState /></Screen>;
  if (auth.status !== "authenticated") return <Redirect href="/sign-in" />;
  if (auth.user.role !== "CUSTOMER") return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
