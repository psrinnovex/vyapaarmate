import Link from "next/link";
import { LegalSection, MobileLegalShell } from "@/components/legal/mobile-legal-shell";
import { createMetadata } from "@/lib/seo";
import { company } from "@/lib/site";

const description = "Terms for the VyapaarMate iOS and Android applications.";

export const metadata = createMetadata({
  title: "Mobile App Terms",
  description,
  path: "/mobile/terms",
  keywords: ["VyapaarMate mobile terms", "VyapaarMate app terms"]
});

export default function MobileTermsPage() {
  return (
    <MobileLegalShell activePath="/mobile/terms">
      <header className="mb-8">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-ocean">Mobile terms</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">VyapaarMate Mobile App Terms</h1>
        <p className="mt-3 text-sm font-semibold text-slate-500">Last updated: 17 August 2026</p>
        <p className="mt-5 max-w-3xl leading-7 text-slate-600">These terms apply to the VyapaarMate iOS and Android apps provided by {company.name}. Using the app means agreeing to these terms and the <Link className="font-semibold text-ocean hover:underline" href="/mobile/privacy">Mobile App Privacy Notice</Link>.</p>
      </header>

      <div className="grid gap-5">
        <LegalSection title="Accounts and supported roles">
          <p>Users must provide accurate account information, protect their credentials, and promptly report suspected unauthorized access. The mobile product is for customer, owner, manager, kitchen-staff, and delivery-staff accounts. Super-admin and support-agent tools remain on the protected website or desktop product and are not mobile app functions.</p>
          <p>A business is responsible for assigning appropriate staff roles and removing access that is no longer needed.</p>
        </LegalSection>

        <LegalSection title="Customer orders and appointments">
          <p>Customer purchases in the app are for physical goods or services fulfilled outside the app. The listed business is responsible for its catalog or service information, availability, prices, taxes, fulfilment, cancellation, refund policy, and customer communication.</p>
          <p>VyapaarMate provides the ordering, booking, and status workflow. The initial mobile release supports payment directly to the business at pickup, dine-in, or service completion; it does not collect card, bank, or UPI credentials in the app. Payment collection and any applicable refund are handled directly with the responsible business under its disclosed terms.</p>
        </LegalSection>

        <LegalSection title="Business app access">
          <p>The business mobile app is a companion for approved accounts with existing access. It may show operational status and existing entitlement information, but it does not sell, start, upgrade, or renew a VyapaarMate software subscription inside the mobile app.</p>
          <p>Business users are responsible for accurate business information, lawful customer communications, consent, staff access, fulfilment, refunds, tax settings, and compliance with laws applicable to their business.</p>
        </LegalSection>

        <LegalSection title="Acceptable use">
          <p>Users must not misuse accounts, access another tenant&apos;s records, interfere with security, submit unlawful or deceptive content, abuse customers or staff, automate unauthorized access, or use the service for fraud. Users must have the rights and permissions required for content and personal information they submit.</p>
        </LegalSection>

        <LegalSection title="Third-party services">
          <p>Payment, maps, messaging, email, SMS, hosting, and other configured integrations may have their own terms and availability. VyapaarMate cannot guarantee an external provider&apos;s uninterrupted service. Users must not treat software suggestions or reports as legal, tax, accounting, financial, medical, or other professional advice.</p>
        </LegalSection>

        <LegalSection title="Suspension, cancellation, and deletion">
          <p>Access may be restricted or suspended for non-payment, fraud, security risk, unlawful conduct, policy violations, or misuse. Customer and staff accounts can use the available deletion process. A business owner can request business-account deletion, which disables active commerce and integrations and schedules the account for processing subject to disclosed retention obligations.</p>
          <p><Link className="font-semibold text-ocean hover:underline" href="/account-deletion">Use the account deletion resource</Link> for the current verified process.</p>
        </LegalSection>

        <LegalSection title="Service availability and changes">
          <p>Some features require a live network connection and configured third-party services. Features may be changed to maintain security, comply with law or store policy, or improve the service. Material changes to these terms will be dated on this page.</p>
        </LegalSection>

        <LegalSection title="Contact">
          <p>Questions about these mobile terms can be sent to <a className="font-semibold text-ocean hover:underline" href={`mailto:${company.supportEmail}`}>{company.supportEmail}</a>.</p>
        </LegalSection>
      </div>
    </MobileLegalShell>
  );
}
