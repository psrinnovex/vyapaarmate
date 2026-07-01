import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/auth-pages";
import { getSessionUser } from "@/lib/api-session";
import { createMetadata, jsonLd } from "@/lib/seo";
import { sessionHomePath } from "@/lib/session-routing";
import { absoluteUrl } from "@/lib/site";
import {
  breadcrumbListNode,
  graph,
  organizationNode,
  webPageNode,
  websiteNode
} from "@/lib/structured-data";

const registerDescription =
  "Create a VyapaarMate user account or submit your Indian local business for approval and owner dashboard access.";

export const metadata = createMetadata({
  title: "Register",
  description: registerDescription,
  path: "/register",
  keywords: ["register business on VyapaarMate", "submit local business", "business ordering setup India"]
});

function registerStructuredData() {
  const path = "/register";
  const breadcrumb = breadcrumbListNode(
    [
      { name: "Home", path: "/" },
      { name: "Register", path }
    ],
    path
  );

  return graph([
    organizationNode(),
    websiteNode(),
    webPageNode({
      path,
      name: "Register for VyapaarMate",
      description: registerDescription,
      breadcrumbId: `${absoluteUrl(path)}#breadcrumb`
    }),
    breadcrumb
  ]);
}

export default async function RegisterPage() {
  const session = await getSessionUser();
  if (session) {
    redirect(sessionHomePath(session));
  }

  return (
    <>
      <script
        id="vyapaarmate-register-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(registerStructuredData()) }}
      />
      <RegisterForm />
    </>
  );
}
