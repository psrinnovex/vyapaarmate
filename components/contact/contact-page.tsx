"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Location, Send2, Sms } from "@/components/ui/iconsax";
import { company } from "@/lib/constants";
import { formString } from "@/lib/form-data";
import { trackMarketingEvent } from "@/components/marketing/marketing-runtime";
import { ClayIllustration, type ClayIllustrationName } from "@/components/illustrations/clay-illustrations";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/form-fields";
import { cn } from "@/lib/utils";
import { launchMarket, launchMarketRestricted, launchSingleCityRestricted } from "@/lib/launch-policy";

const businessPicks: { label: string; art: ClayIllustrationName }[] = [
  { label: "Restaurant", art: "bowl" },
  { label: "Tiffin center", art: "tiffin" },
  { label: "Bakery", art: "cake" },
  { label: "Juice bar", art: "juice" },
  { label: "Salon", art: "salon" },
  { label: "Grocery", art: "grocery" }
];

const nextSteps: { title: string; art: ClayIllustrationName }[] = [
  { title: "We call you", art: "phone" },
  { title: "We set up your shop", art: "shop" },
  { title: "You go live", art: "rocket" }
];

/** The demo-request form section; the page hero is rendered by app/contact/page.tsx. */
export function ContactPageContent() {
  const [submitting, setSubmitting] = useState(false);
  const [business, setBusiness] = useState("");
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  async function submitDemoRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: formString(formData, "name"),
      phone: formString(formData, "phone"),
      business: formString(formData, "business"),
      city: formString(formData, "city"),
      message: formString(formData, "message"),
      website: formString(formData, "website")
    };

    setSubmitting(true);
    setNotice(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const responsePayload = (await response.json().catch(() => ({}))) as { error?: unknown; message?: unknown };

      if (!response.ok) {
        const errorMessage = typeof responsePayload.error === "string"
          ? responsePayload.error
          : "We could not send your demo request right now. Please try again shortly.";
        setNotice({ tone: "error", message: errorMessage });
        return;
      }

      trackMarketingEvent("generate_lead", {
        lead_type: "demo_request",
        business_type: payload.business,
        launch_city: payload.city.toLowerCase(),
        page_path: "/contact"
      });
      setNotice({
        tone: "success",
        message: typeof responsePayload.message === "string"
          ? responsePayload.message
          : launchMarketRestricted
            ? "Your demo request was sent to our pilot team."
            : "Your demo request was sent to our team."
      });
    } catch {
      setNotice({
        tone: "error",
        message: "We could not send your demo request. Check your connection and try again."
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="demo-request" className="mx-auto grid max-w-7xl gap-6 px-4 pb-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
      <ScrollReveal className="h-full" direction="right">
        <div className="relative flex h-full flex-col overflow-hidden rounded-[2.25rem] vm-band p-6 text-white shadow-clay-lg sm:p-8">
          <div aria-hidden="true" className="vm-blob -right-20 -top-20 size-72 bg-brand opacity-25" />
          <h2 className="relative text-2xl font-extrabold tracking-[-0.03em]">{company.name}</h2>
          <div className="relative mt-5 grid gap-3 text-sm font-semibold text-white/80">
            <a href={`mailto:${company.supportEmail}`} className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 ring-1 ring-white/10 transition hover:bg-white/15">
              <span className="clay-orb size-10 shrink-0 rounded-xl bg-clay-green text-ink"><Sms className="size-5" variant="Bulk" /></span>
              <span className="min-w-0 break-words">{company.supportEmail}</span>
            </a>
            <p className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
              <span className="clay-orb size-10 shrink-0 rounded-xl bg-clay-peacock text-white"><Location className="size-5" variant="Bulk" /></span>
              <span className="min-w-0 break-words">{company.address}</span>
            </p>
          </div>
          <ol className="relative mt-8 grid gap-4">
            {nextSteps.map((step, index) => (
              <li key={step.title} className="flex items-center gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/95 p-1.5 shadow-clay-sm">
                  <ClayIllustration name={step.art} />
                </span>
                <span>
                  <span className="block text-xs font-extrabold uppercase tracking-[0.1em] text-green-200">Step {index + 1}</span>
                  <span className="block text-base font-extrabold">{step.title}</span>
                </span>
              </li>
            ))}
          </ol>
          <div aria-hidden="true" className="relative mt-auto w-36 self-end pt-6 sm:w-44">
            <ClayIllustration name="shop" className="motion-safe:animate-float-slow" />
          </div>
        </div>
      </ScrollReveal>
      <ScrollReveal className="h-full" delay={90}>
        <div className="clay h-full rounded-[2.25rem] p-6 sm:p-8">
          <form className="grid gap-5" onSubmit={submitDemoRequest}>
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="Your name" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="business">Business type</Label>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Pick a business type">
                {businessPicks.map((pick) => (
                  <button
                    key={pick.label}
                    type="button"
                    onClick={() => setBusiness(pick.label)}
                    aria-pressed={business === pick.label}
                    className={cn(
                      "flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-sm font-bold transition",
                      business === pick.label ? "bg-clay-ink text-white shadow-clay-sm theme-dark" : "bg-ivory-100/80 text-ink-600 hover:bg-white hover:shadow-clay-sm"
                    )}
                  >
                    <span className="size-7 rounded-full bg-white p-0.5"><ClayIllustration name={pick.art} /></span>
                    {pick.label}
                  </button>
                ))}
              </div>
              <Input id="business" name="business" value={business} onChange={(event) => setBusiness(event.target.value)} placeholder="Or type it: restaurant, tiffin center, bakery" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <PhoneInput id="phone" name="phone" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="city">Launch city</Label>
                <Input id="city" name="city" defaultValue={launchSingleCityRestricted ? launchMarket.city : ""} readOnly={launchSingleCityRestricted} required />
              </div>
            </div>
            <p className="-mt-2 text-xs font-semibold leading-5 text-ink-500">
              {launchMarketRestricted
                ? `Demo onboarding is currently available only for ${launchMarket.displayName} businesses.`
                : "Enter the city where your business operates."}
            </p>
            <div className="grid gap-2">
              <Label htmlFor="message">Message</Label>
              <Textarea id="message" name="message" placeholder="Tell us about your ordering or booking workflow" maxLength={2000} required />
            </div>
            <div className="hidden" aria-hidden="true">
              <Label htmlFor="website">Website</Label>
              <Input id="website" name="website" tabIndex={-1} autoComplete="off" />
            </div>
            <p className="text-xs leading-5 text-ink-500">
              By submitting, you agree that our launch team may contact you about this request. See our{" "}
              <Link href="/privacy" className="font-semibold text-brand-text">Privacy Policy</Link> and{" "}
              <Link href="/terms" className="font-semibold text-brand-text">Terms</Link>.
            </p>
            {notice && (
              <p
                role="status"
                aria-live="polite"
                className={cn(
                  "flex items-center gap-3 rounded-2xl p-3 text-sm font-semibold",
                  notice.tone === "success" ? "bg-green-50 text-green-700" : "bg-kumkum-50 text-kumkum-700"
                )}
              >
                {notice.tone === "success" && <span className="size-9 shrink-0"><ClayIllustration name="success" /></span>}
                {notice.message}
              </p>
            )}
            <Button type="submit" size="lg" variant="brand" disabled={submitting} icon={<Send2 className="size-5" variant="Bold" />}>
              {submitting ? "Sending Demo Request" : "Submit Demo Request"}
            </Button>
          </form>
        </div>
      </ScrollReveal>
    </section>
  );
}
