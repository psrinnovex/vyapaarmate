import { CheckCircle2, Globe2, Laptop, MonitorSmartphone, ShieldCheck, Smartphone } from "lucide-react";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createMetadata } from "@/lib/seo";

const installDescription =
  "Install VyapaarMate for customers and business teams on iPhone, iPad, Android, Windows, and Mac, or use the same secure website in any modern browser.";

export const metadata = createMetadata({
  title: "Install VyapaarMate",
  description: installDescription,
  path: "/install",
  keywords: ["VyapaarMate app", "VyapaarMate iPhone", "VyapaarMate Android", "VyapaarMate desktop"]
});

const installOptions = [
  {
    name: "iPhone and iPad",
    icon: Smartphone,
    text: "Open VyapaarMate in Safari, tap Share, choose Add to Home Screen, turn on Open as Web App, and tap Add."
  },
  {
    name: "Android",
    icon: MonitorSmartphone,
    text: "Open VyapaarMate in Chrome or Edge and choose Install app from the browser prompt or menu."
  },
  {
    name: "Windows desktop",
    icon: Laptop,
    text: "Open VyapaarMate in Chrome or Edge, then use the install icon in the address bar or choose Install VyapaarMate from the menu."
  },
  {
    name: "MacBook and Mac",
    icon: Laptop,
    text: "In Safari on macOS Sonoma 14 or later, choose File > Add to Dock. Chrome and Edge also provide an Install option."
  }
];

function Availability({ available }: { available: boolean }) {
  return available ? (
    <span className="inline-flex items-center gap-1 font-semibold text-emerald"><CheckCircle2 className="size-4" /> Yes</span>
  ) : (
    <span className="font-semibold text-slate-400">Not offered</span>
  );
}

export default function InstallPage() {
  return (
    <main className="min-h-screen bg-mist text-ink">
      <PublicHeader />

      <section className="border-b border-line bg-white px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald text-white shadow-lg"><MonitorSmartphone className="size-7" /></span>
          <p className="mt-5 text-sm font-bold uppercase tracking-[0.2em] text-emerald">One account, every approved screen</p>
          <h1 className="mx-auto mt-3 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">Use VyapaarMate on phone, desktop, Mac, or the web</h1>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">{installDescription}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/login?type=user&next=/user" size="lg" variant="emerald">Open user portal</ButtonLink>
            <ButtonLink href="/login?next=/dashboard" size="lg" variant="secondary">Open business workspace</ButtonLink>
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-4 sm:grid-cols-2">
            {installOptions.map((option) => {
              const Icon = option.icon;
              return (
                <Card key={option.name} className="bg-white p-5 sm:p-6">
                  <span className="grid size-11 place-items-center rounded-xl bg-ocean/10 text-ocean"><Icon className="size-5" /></span>
                  <h2 className="mt-4 text-lg font-bold">{option.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{option.text}</p>
                </Card>
              );
            })}
          </div>

          <Card className="mt-8 overflow-hidden bg-white p-0">
            <div className="border-b border-line p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald/10 text-emerald"><ShieldCheck className="size-5" /></span>
                <div>
                  <h2 className="text-xl font-bold">Platform access by role</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">Customer and business workspaces are supported across every listed platform. VyapaarMate offers admin and support installation only on Windows and Mac; their normal website remains available.</p>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Audience</th>
                    <th className="px-5 py-3"><span className="inline-flex items-center gap-1"><Globe2 className="size-4" /> Website</span></th>
                    <th className="px-5 py-3">iPhone/iPad</th>
                    <th className="px-5 py-3">Android</th>
                    <th className="px-5 py-3">Windows</th>
                    <th className="px-5 py-3">Mac</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  <tr>
                    <th className="px-5 py-4 font-bold">Users and customers</th>
                    {[true, true, true, true, true].map((available, index) => <td key={index} className="px-5 py-4"><Availability available={available} /></td>)}
                  </tr>
                  <tr>
                    <th className="px-5 py-4 font-bold">Business owners and teams</th>
                    {[true, true, true, true, true].map((available, index) => <td key={index} className="px-5 py-4"><Availability available={available} /></td>)}
                  </tr>
                  <tr>
                    <th className="px-5 py-4 font-bold">Admin and support</th>
                    {[true, false, false, true, true].map((available, index) => <td key={index} className="px-5 py-4"><Availability available={available} /></td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-5 text-slate-500">The installable version is the same secure, responsive web application and does not cache private API responses or account data. Installation suggestions require a verified supported account; browser installation itself is not an authorization boundary. App Store and Play Store binaries require a separate native client, store-policy review, signing, and physical-device release testing.</p>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
