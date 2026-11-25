import { RefreshCw } from "lucide-react";
import { ClayIllustration } from "@/components/illustrations/clay-illustrations";
import { ButtonLink } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 text-center text-ink">
      <div aria-hidden="true" className="vm-blob left-[10%] top-[12%] size-72 bg-violet" />
      <div aria-hidden="true" className="vm-blob bottom-[10%] right-[8%] size-72 bg-sky" />
      <section className="clay relative max-w-md rounded-[2.25rem] p-8">
        <div className="mx-auto w-40 motion-safe:animate-float-slow">
          <ClayIllustration name="phone" />
        </div>
        <span className="sticker mt-4 bg-clay-mango text-ink">No connection</span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-[-0.04em]">You’re offline</h1>
        <p className="mt-3 text-sm font-medium leading-6 text-slate-600">Reconnect to load current appointment availability, bookings, payments, and customer data. VyapaarMate never shows stale private records as current.</p>
        <ButtonLink href="/" size="lg" className="mt-6 w-full" icon={<RefreshCw className="size-5" />}>
          Try again
        </ButtonLink>
      </section>
    </main>
  );
}
