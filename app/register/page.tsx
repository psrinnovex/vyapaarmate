import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/auth-pages";
import { getSessionUser } from "@/lib/api-session";
import { pricingPlans } from "@/lib/constants";
import { launchMarket, launchOffer } from "@/lib/launch-policy";
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

const registerDescription = launchOffer.publiclyAdvertised
  ? `Apply for the current ${launchMarket.displayName} launch. The automatic 80% discount makes Starter ${pricingPlans[0].price.toFixed(2)} INR and Pro ${pricingPlans[1].price.toFixed(2)} INR per month, plus GST.`
  : `Create a VyapaarMate account or submit your ${launchMarket.displayName} business for approval and owner dashboard access.`;

export const metadata = createMetadata({
  title: "Register",
  description: registerDescription,
  path: "/register",
  keywords: ["register business on VyapaarMate", "Bengaluru business software", "Bangalore business onboarding"]
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
      {launchOffer.publiclyAdvertised && (
        <section className="border-b border-emerald/20 bg-emerald/5 px-4 py-3 text-center text-sm leading-6 text-slate-700">
          <strong className="text-ink">Bengaluru launch:</strong> 80% off is applied automatically to every monthly subscription while enabled, not only the first month. GST, setup, gateway, WhatsApp, and other provider charges are separate; coupons do not stack.
        </section>
      )}
      <RegisterForm />
    </>
  );
}
