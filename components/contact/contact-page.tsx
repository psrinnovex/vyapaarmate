"use client";

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

export function ContactPageContent() {
  const [message, setMessage] = useState("");

  function submitDemoRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const name = formString(formData, "name", "your business");
    const businessType = formString(formData, "business", "not provided");
    trackMarketingEvent("generate_lead", {
      lead_type: "demo_request",
      business_type: businessType,
      page_path: "/contact"
    });
    setMessage(`Demo request submitted for ${name}.`);
  }

  return (
    <Section
      eyebrow="Contact"
      title="Book a VyapaarMate demo"
      body="Share your business type and ordering workflow. The PSHR INNOVEX PRIVATE LIMITED team can help configure a direct ordering setup."
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
                <Label htmlFor="message">Message</Label>
                <Textarea id="message" name="message" placeholder="Tell us about your ordering workflow" required />
              </div>
              {message && <p className="rounded-lg bg-emerald/10 p-3 text-sm font-semibold text-emerald">{message}</p>}
              <Button type="submit" variant="emerald" icon={<Send2 className="size-5" variant="Bold" />}>
                Submit Demo Request
              </Button>
            </form>
          </Card>
        </ScrollReveal>
      </div>
    </Section>
  );
}
