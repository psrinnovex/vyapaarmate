import { Suspense } from "react";
import { ForgotPasswordPage } from "@/components/auth/auth-pages";
import { AuthPageSkeleton } from "@/components/ui/skeleton";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata({
  title: "Reset Password",
  description: "Reset your VyapaarMate account password.",
  path: "/forgot-password",
  noIndex: true
});

export default function ForgotPasswordRoute() {
  return (
    <Suspense fallback={<AuthPageSkeleton />}>
      <ForgotPasswordPage />
    </Suspense>
  );
}
