import { CheckCircle2, MinusCircle } from "lucide-react";
import { ClayIllustration, type ClayIllustrationName } from "@/components/illustrations/clay-illustrations";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { InstallGuide } from "@/components/marketing/install-guide";
import { PageHeroBanner, PublicPage, SectionTitle } from "@/components/marketing/page-kit";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createMetadata } from "@/lib/seo";

const installDescription =
  "Install VyapaarMate for customers and business teams on iPhone, iPad, Android, Windows, and Mac, or use the same secure website in any modern browser.";

export const metadata = createMetadata({
  title: "Install VyapaarMate",
  description: installDescription,
  path: "/install",
  keywords: ["VyapaarMate app", "VyapaarMate iPhone", "VyapaarMate Android", "VyapaarMate desktop"]
});

const roleRows: { audience: string; art: ClayIllustrationName; availability: boolean[] }[] = [
  { audience: "Users and customers", art: "customers", availability: [true, true, true, true, true] },
  { audience: "Business owners and teams", art: "shop", availability: [true, true, true, true, true] },
  { audience: "Admin and support", art: "shield", availability: [true, false, false, true, true] }
];

const platformColumns = ["Website", "iPhone/iPad", "Android", "Windows", "Mac"];

export default function InstallPage() {
  return (
    <PublicPage>
      <PageHeroBanner
        eyebrow="One account, every approved screen"
        eyebrowTone="sky"
        title="Use VyapaarMate on phone, desktop, Mac,"
        highlight="or the web"
        body={installDescription}
        art="phone"
        sideArt={["shop", "success"]}
        actions={
          <>
            <ButtonLink href="/login?type=user&next=/user" size="lg" variant="emerald">
              Open user portal
            </ButtonLink>
            <ButtonLink href="/login?next=/dashboard" size="lg" variant="secondary">
              Open business workspace
            </ButtonLink>
          </>
        }
      />

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <SectionTitle eyebrow="Install" title="Pick your device," highlight="follow the taps" />
        <div className="mt-10">
          <InstallGuide />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <SectionTitle
          eyebrow="Platform access by role"
          title="Who can install"
          highlight="where"
          body="Customer and business workspaces are supported across every listed platform. VyapaarMate offers admin and support installation only on Windows and Mac; their normal website remains available."
        />
        <div className="mt-10 grid gap-4">
          {roleRows.map((row, rowIndex) => (
            <ScrollReveal key={row.audience} delay={rowIndex * 80}>
              <div className="clay grid items-center gap-4 rounded-[2rem] p-4 sm:p-5 lg:grid-cols-[17rem_1fr]">
                <div className="flex items-center gap-3">
                  <span className="size-14 shrink-0 rounded-2xl bg-mist p-1.5">
                    <ClayIllustration name={row.art} />
                  </span>
                  <h2 className="text-base font-extrabold leading-6">{row.audience}</h2>
                </div>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {platformColumns.map((platform, index) => {
                    const available = row.availability[index];
                    return (
                      <li
                        key={platform}
                        className={cn(
                          "flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-bold",
                          available ? "bg-emerald-soft text-emerald-deep" : "bg-slate-100 text-slate-400"
                        )}
                      >
                        {available ? <CheckCircle2 className="size-4 shrink-0" /> : <MinusCircle className="size-4 shrink-0" />}
                        <span className="min-w-0">
                          {platform}
                          {!available && <span className="sr-only">: not offered</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </ScrollReveal>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-5 text-slate-500">The installable version is the same secure, responsive web application and does not cache private API responses or account data. Installation suggestions require a verified supported account; browser installation itself is not an authorization boundary. App Store and Play Store binaries require a separate native client, store-policy review, signing, and physical-device release testing.</p>
      </section>
    </PublicPage>
  );
}
