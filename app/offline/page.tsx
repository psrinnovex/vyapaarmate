import { WifiOff } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-mist px-4 text-center text-ink">
      <section className="max-w-md rounded-2xl border border-line bg-white p-7 shadow-xl">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-ocean/10 text-ocean"><WifiOff className="size-7" /></span>
        <h1 className="mt-5 text-2xl font-bold">You’re offline</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Reconnect to load current appointment availability, bookings, payments, and customer data. VyapaarMate never shows stale private records as current.</p>
        <ButtonLink href="/" className="mt-5 w-full">Try again</ButtonLink>
      </section>
    </main>
  );
}
