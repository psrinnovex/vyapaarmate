import { CheckCheck, FlaskConical, Store } from "lucide-react";
import { Sticker } from "@/components/ui/sticker";

/**
 * Demo-only preview of the WhatsApp updates a customer would receive. In live mode the
 * same details go out through the approved WhatsApp template.
 */
export function WhatsappPreview({ businessName, messages }: { businessName: string; messages: string[] }) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-white/80 bg-[#efeae2] shadow-clay">
      <div className="flex items-center gap-2.5 bg-[#0b7d49] px-4 py-3 text-white">
        <span className="grid size-9 place-items-center rounded-full bg-white text-brand-text">
          <Store className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold">{businessName}</p>
          <p className="text-[11px] font-semibold text-white/75">WhatsApp preview</p>
        </div>
        <Sticker tone="marigold" tilt={4} icon={<FlaskConical className="size-3" />}>
          Demo
        </Sticker>
      </div>
      <div className="grid gap-2 p-3">
        {messages.map((message, index) => (
          <div key={index} className="max-w-[92%] rounded-2xl rounded-tl-md bg-white px-3 py-2 text-[13px] font-semibold leading-5 text-ink shadow-sm">
            {message}
            <span className="mt-0.5 flex items-center justify-end gap-0.5 text-[10px] text-ink-500">
              now <CheckCheck className="size-3 text-peacock-600" />
            </span>
          </div>
        ))}
      </div>
      <p className="px-4 pb-3 text-[11px] font-semibold text-ink-500">With WhatsApp connected, these go to the customer automatically.</p>
    </div>
  );
}
