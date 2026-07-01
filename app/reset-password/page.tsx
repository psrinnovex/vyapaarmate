import { Suspense } from "react";
import { ResetPasswordPage } from "@/components/auth/auth-pages";
import { AuthPageSkeleton } from "@/components/ui/skeleton";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata({
  title: "Set New Password",
  description: "Choose a new VyapaarMate account password.",
  path: "/reset-password",
  noIndex: true
});

export default function ResetPasswordRoute() {
  return (
    <Suspense fallback={<AuthPageSkeleton />}>
      <ResetPasswordPage />
    </Suspense>
  );
}
