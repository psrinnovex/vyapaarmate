import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-12 w-full rounded-2xl border border-line bg-white/90 px-4 text-sm text-ink shadow-clay-inset outline-none transition placeholder:text-slate-400 focus:border-emerald focus:bg-white focus:ring-4 focus:ring-emerald/15",
        className
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-24 w-full rounded-2xl border border-line bg-white/90 px-4 py-3 text-sm text-ink shadow-clay-inset outline-none transition placeholder:text-slate-400 focus:border-emerald focus:bg-white focus:ring-4 focus:ring-emerald/15",
        className
      )}
      {...props}
    />
  );
});

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-bold text-slate-700", className)} {...props} />;
}
