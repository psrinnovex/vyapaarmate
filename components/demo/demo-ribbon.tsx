import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { demoModeUiEnabled } from "@/lib/demo-mode";

/** Small always-visible marker on every page while the demo environment is on. */
export function DemoRibbon() {
  if (!demoModeUiEnabled) return null;

  return (
    <Link
      href="/demo"
      className="group fixed bottom-3 left-3 z-[65] inline-flex items-center gap-1.5 rounded-full border-[3px] border-white bg-clay-mango px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-ink shadow-[0_5px_0_-1px_rgba(29,26,57,0.14),0_12px_20px_-10px_rgba(29,26,57,0.4)] transition hover:-translate-y-0.5 print:hidden"
      title="Demo environment: payments and WhatsApp messages are simulated"
    >
      <FlaskConical className="size-3.5" />
      Demo
      <span className="hidden normal-case tracking-normal text-ink/70 sm:group-hover:inline">· payments are simulated</span>
    </Link>
  );
}
