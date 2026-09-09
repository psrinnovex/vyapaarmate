"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Location, Send2, Sms } from "@/components/ui/iconsax";
import { company } from "@/lib/constants";
import { formString } from "@/lib/form-data";
import { trackMarketingEvent } from "@/components/marketing/marketing-runtime";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/form-fields";
import { Section } from "@/components/ui/section";
import { launchMarket, launchMarketRestricted, launchSingleCityRestricted } from "@/lib/launch-policy";

export function ContactPageContent() {
  const [submitting, setSubmitting] = useState(false);
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
    <Section
      headingAs="h1"
      eyebrow="Contact"
      title="Book a VyapaarMate demo"
      body={
        launchMarketRestricted
          ? `We are currently onboarding businesses in ${launchMarket.displayName}. Share your business type and workflow, and our team will contact you about your pilot cohort and setup.`
          : "Share your city, business type, and workflow, and our team will contact you about product availability and setup."
      }
    >
      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <ScrollReveal className="h-full" direction="right">
          <Card className="h-full bg-ink text-white">
            <h2 className="text-xl font-bold">{company.name}</h2>
            <div className="mt-6 grid gap-4 text-sm text-white/75">
              <p className="flex items-center gap-3"><Sms className="size-5 shrink-0" variant="Bulk" /> {company.supportEmail}</p>
              <p className="flex items-center gap-3"><Location className="size-5 shrink-0" variant="Bulk" /> {company.address}</p>
            </div>
          </Card>
        </ScrollReveal>
        <ScrollReveal className="h-full" delay={90}>
          <Card className="h-full bg-white/90">
            <form className="grid gap-4" onSubmit={submitDemoRequest}>
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" placeholder="Your name" required />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <PhoneInput id="phone" name="phone" required />
                </div>
                <div>
                  <Label htmlFor="business">Business type</Label>
                  <Input id="business" name="business" placeholder="Restaurant, tiffin center, bakery" required />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="city">Launch city</Label>
                <Input id="city" name="city" defaultValue={launchSingleCityRestricted ? launchMarket.city : ""} readOnly={launchSingleCityRestricted} required />
                <p className="text-xs font-semibold leading-5 text-slate-500">
                  {launchMarketRestricted
                    ? `Demo onboarding is currently available only for ${launchMarket.displayName} businesses.`
                    : "Enter the city where your business operates."}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="message">Message</Label>
                <Textarea id="message" name="message" placeholder="Tell us about your ordering or booking workflow" maxLength={2000} required />
              </div>
              <div className="hidden" aria-hidden="true">
                <Label htmlFor="website">Website</Label>
                <Input id="website" name="website" tabIndex={-1} autoComplete="off" />
              </div>
              <p className="text-xs leading-5 text-slate-500">
                By submitting, you agree that our launch team may contact you about this request. See our{" "}
                <Link href="/privacy" className="font-semibold text-ocean">Privacy Policy</Link> and{" "}
                <Link href="/terms" className="font-semibold text-ocean">Terms</Link>.
              </p>
              {notice && (
                <p
                  role="status"
                  aria-live="polite"
                  className={`rounded-lg p-3 text-sm font-semibold ${
                    notice.tone === "success" ? "bg-emerald/10 text-emerald" : "bg-red-50 text-red-700"
                  }`}
                >
                  {notice.message}
                </p>
              )}
              <Button type="submit" variant="emerald" disabled={submitting} icon={<Send2 className="size-5" variant="Bold" />}>
                {submitting ? "Sending Demo Request" : "Submit Demo Request"}
              </Button>
            </form>
          </Card>
        </ScrollReveal>
      </div>
    </Section>
  );
}
