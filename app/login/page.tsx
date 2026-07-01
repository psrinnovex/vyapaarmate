import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/auth-pages";
import { AuthPageSkeleton } from "@/components/ui/skeleton";
import { getSessionUser } from "@/lib/api-session";
import { createMetadata } from "@/lib/seo";
import { sessionRedirectPath } from "@/lib/session-routing";

export const metadata = createMetadata({
  title: "Sign In",
  description: "Sign in to VyapaarMate as a user or business owner.",
  path: "/login",
  noIndex: true
});

type LoginPageProps = {
  searchParams?: Promise<{
    next?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getSessionUser();
  if (session) {
    const params = await searchParams;
    redirect(sessionRedirectPath(session, params?.next));
  }

  return (
    <Suspense fallback={<AuthPageSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}
