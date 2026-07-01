"use client";

import { useEffect } from "react";
import { CheckCircle2, LoaderCircle, UploadCloud } from "lucide-react";
import { orderAnimationPaths } from "@/lib/order-animations";
import { Button } from "@/components/ui/button";
import { LazyLottieAnimation } from "@/components/ui/lottie-animation";
import { cn } from "@/lib/utils";

export type KycUploadFeedback = {
  status: "uploading" | "success";
  label: string;
  fileName: string;
  readyForReview?: boolean;
};

export function KycUploadFeedbackDialog({
  feedback,
  onClose
}: {
  feedback: KycUploadFeedback | null;
  onClose: () => void;
}) {
  const completed = feedback?.status === "success";

  useEffect(() => {
    if (!completed) return;
    const timer = window.setTimeout(onClose, 3200);
    return () => window.clearTimeout(timer);
  }, [completed, onClose]);

  if (!feedback) return null;

  const uploading = feedback.status === "uploading";
  const title = uploading ? "Uploading document" : "Document uploaded";
  const body = uploading
    ? `Securely saving ${feedback.label}. Keep this tab open until it finishes.`
    : feedback.readyForReview
      ? "All required KYC documents are ready for PSHR admin review."
      : `${feedback.label} is saved. Upload the remaining documents to continue verification.`;

  return (
    <div
      role={completed ? "dialog" : "status"}
      aria-label={title}
      aria-live="polite"
      aria-modal={completed ? true : undefined}
      className="payment-celebration fixed inset-0 z-[90] grid place-items-center overflow-hidden bg-ink/45 px-4 backdrop-blur-sm print:hidden"
    >
      <div key={feedback.status} className="payment-celebration-card relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-white/80 bg-white p-6 text-center shadow-[0_32px_100px_rgba(13,19,33,0.32)]">
        <LazyLottieAnimation
          src={uploading ? orderAnimationPaths.serviceInProgress : orderAnimationPaths.serviceReady}
          label={title}
          loop={uploading}
          className="mx-auto size-32 rounded-2xl bg-mist"
          animationClassName="kyc-upload-lottie"
          fallback={
            <div
              className={cn(
                "grid size-24 place-items-center rounded-full border bg-white",
                uploading ? "border-ocean/20 text-ocean" : "border-emerald/20 text-emerald"
              )}
            >
              {uploading ? (
                <UploadCloud className="size-11 animate-pulse motion-reduce:animate-none" />
              ) : (
                <CheckCircle2 className="size-12 payment-success-icon" />
              )}
            </div>
          }
        />
        <p className={cn("mt-5 text-xs font-extrabold uppercase tracking-[0.2em]", uploading ? "text-ocean" : "text-emerald")}>
          {uploading ? "Secure upload" : "Upload complete"}
        </p>
        <h2 className="mt-2 text-2xl font-extrabold text-ink">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
        <div className="mt-5 rounded-lg border border-line bg-mist p-3 text-left">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{feedback.label}</p>
          <p className="mt-1 truncate text-sm font-bold text-ink">{feedback.fileName}</p>
        </div>
        {uploading ? (
          <div className="mt-5 flex items-center justify-center gap-2 text-sm font-semibold text-slate-600">
            <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
            <span>Uploading and validating file</span>
          </div>
        ) : (
          <>
            <div className="mx-auto mt-5 h-1.5 w-40 overflow-hidden rounded-full bg-slate-100">
              <span className="payment-celebration-progress block h-full rounded-full bg-emerald" />
            </div>
            <Button className="mt-5 w-full" variant="emerald" icon={<CheckCircle2 className="size-4" />} onClick={onClose}>
              Done
            </Button>
          </>
        )}
      </div>
      {completed && Array.from({ length: 14 }, (_, index) => <span key={index} className="payment-confetti" aria-hidden="true" />)}
    </div>
  );
}
