import Link from "next/link";
import { LegalSection, MobileLegalShell } from "@/components/legal/mobile-legal-shell";
import { createMetadata } from "@/lib/seo";
import { company } from "@/lib/site";

const description = "Privacy information for the VyapaarMate iOS and Android applications.";

export const metadata = createMetadata({
  title: "Mobile App Privacy",
  description,
  path: "/mobile/privacy",
  keywords: ["VyapaarMate mobile privacy", "VyapaarMate app privacy"]
});

export default function MobilePrivacyPage() {
  return (
    <MobileLegalShell activePath="/mobile/privacy">
      <header className="mb-8">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-ocean">Mobile privacy</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">VyapaarMate Mobile App Privacy Notice</h1>
        <p className="mt-3 text-sm font-semibold text-slate-500">Last updated: 17 August 2026</p>
        <p className="mt-5 max-w-3xl leading-7 text-slate-600">
          This notice explains the data handled when customers and approved business users use the VyapaarMate iOS or Android app. It also explains how to request access, correction, export, or deletion.
        </p>
      </header>

      <div className="grid gap-5">
        <LegalSection title="Who provides VyapaarMate">
          <p>{company.product} is provided by {company.name}. General privacy and account-support questions can be sent to <a className="font-semibold text-ocean hover:underline" href={`mailto:${company.supportEmail}`}>{company.supportEmail}</a>.</p>
        </LegalSection>

        <LegalSection title="Information handled by the mobile app">
          <ul className="list-disc space-y-2 pl-5">
            <li>Account and contact information such as name, email address, phone number, account role, and user identifier.</li>
            <li>Customer information such as a service address, order notes, orders, appointments, invoices, and payment status. The initial mobile release accepts payment to the business only at physical fulfilment and does not collect card, bank, or UPI credentials.</li>
            <li>Business operational information such as the business profile, order and appointment workflow, customer contact details needed for fulfilment, and role-permitted status updates.</li>
            <li>Location coordinates only when a customer explicitly asks to sort nearby businesses or confirm an at-location service request. Discovery coordinates stay on the device; coordinates submitted with a service request are linked to that order.</li>
            <li>Security and session information such as app platform, app version, session identifiers, network address, and security events. The app does not intentionally collect an advertising identifier or hardware device identifier.</li>
          </ul>
        </LegalSection>

        <LegalSection title="How information is used">
          <ul className="list-disc space-y-2 pl-5">
            <li>Authenticate accounts, enforce customer and business roles, and protect tenant-isolated records.</li>
            <li>Provide ordering, booking, fulfilment, customer support, business operations, reporting, and account-management functions.</li>
            <li>Record payment status for physical goods or services, prevent fraud, resolve disputes, and meet accounting or legal obligations.</li>
            <li>Send required transactional communications. This mobile release does not opt a customer into marketing or WhatsApp messaging.</li>
            <li>Diagnose faults, maintain security, and improve reliability.</li>
          </ul>
          <p>VyapaarMate does not sell personal data. The mobile app is not intended to use personal data for third-party advertising or cross-app tracking.</p>
        </LegalSection>

        <LegalSection title="Service providers and other recipients">
          <p>Only the information needed for a requested workflow may be sent to configured hosting and database providers, email or SMS providers, and security providers. A customer&apos;s order information is also available to the business responsible for that order or appointment. The operating system provides location coordinates to the app only after permission is granted; VyapaarMate does not embed an advertising or third-party analytics SDK in this release.</p>
          <p>The initial mobile release does not collect payment-card credentials, business payout or bank details, or identity-verification documents. Those business workflows remain website-only.</p>
        </LegalSection>

        <LegalSection title="Retention and account deletion">
          <p>Account and operational data is kept only for the service, security, accounting, dispute, fraud-prevention, and legal purposes that apply to it. Retention is not represented as unlimited, and deleting an account does not mean that records which must lawfully be retained are erased.</p>
          <p>When an account deletion is completed, sign-in access is removed and personal fields that are not required for a documented retention purpose are deleted or anonymized. Business deletion requests disable the storefront, commerce, messaging integrations, subscription access, and active app sessions while the scheduled deletion is processed.</p>
          <p><Link className="font-semibold text-ocean hover:underline" href="/account-deletion">Open the account deletion resource</Link> to initiate or continue a verified request.</p>
        </LegalSection>

        <LegalSection title="Your choices">
          <ul className="list-disc space-y-2 pl-5">
            <li>Update available profile and business information from the applicable account settings.</li>
            <li>Change communication consent for the relevant business relationship.</li>
            <li>Request a copy of available account data from authenticated settings.</li>
            <li>Request correction or deletion through the account deletion resource or by contacting support when account recovery is required.</li>
            <li>Decline location access and continue browsing or searching without nearby sorting. An at-location service request requires both an entered address and location coordinates so the business&apos;s service radius can be enforced.</li>
          </ul>
        </LegalSection>

        <LegalSection title="Security, website context, and changes">
          <p>VyapaarMate uses HTTPS, access controls, role and tenant checks, protected session storage, rate limits, and audit records for sensitive actions. No method of storage or transmission can be guaranteed completely secure.</p>
          <p>These public web resources may use configured website analytics and performance services. Website collection is separate from the native app disclosure and must also follow the public website privacy policy.</p>
          <p>This notice will be updated before a materially different mobile data practice begins. The date at the top identifies the current version.</p>
        </LegalSection>
      </div>
    </MobileLegalShell>
  );
}
