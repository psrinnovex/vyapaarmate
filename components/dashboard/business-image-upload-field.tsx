"use client";

import Image from "next/image";
import { useEffect, useState, type ChangeEvent } from "react";
import { ImagePlus, LoaderCircle } from "lucide-react";
import { optimizeBusinessImage } from "@/lib/client-image";
import { BUSINESS_IMAGE_MAX_DIMENSION, BUSINESS_IMAGE_MAX_STORED_BYTES } from "@/lib/business-image";
import { Label } from "@/components/ui/input";

type BusinessImageUploadFieldProps = {
  imageUrl: string | null;
  disabled?: boolean;
  onPendingImageChange: (imageDataUrl: string | null | undefined) => void;
  onError: (message: string) => void;
};

function shouldSkipImageOptimization(src: string) {
  return src.startsWith("data:") || src.toLowerCase().split("?")[0].endsWith(".svg");
}

export function BusinessImageUploadField({
  imageUrl,
  disabled = false,
  onPendingImageChange,
  onError
}: BusinessImageUploadFieldProps) {
  const [preview, setPreview] = useState<string | null>(imageUrl);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setPreview(imageUrl);
      onPendingImageChange(undefined);
    });

    return () => {
      cancelled = true;
    };
  }, [imageUrl, onPendingImageChange]);

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    setProcessing(true);
    try {
      const imageDataUrl = await optimizeBusinessImage(file);
      setPreview(imageDataUrl);
      onPendingImageChange(imageDataUrl);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not prepare this business image.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="grid gap-2">
      <Label>Business image</Label>
      <div className="grid gap-3 rounded-lg border border-line bg-mist/60 p-3 sm:grid-cols-[112px_1fr] sm:items-center">
        <div className="relative aspect-square overflow-hidden rounded-lg bg-white">
          {preview ? (
            <Image
              src={preview}
              alt="Business image preview"
              fill
              sizes="112px"
              className="object-cover"
              unoptimized={shouldSkipImageOptimization(preview)}
            />
          ) : (
            <div className="grid h-full place-items-center text-slate-400">
              <ImagePlus className="size-8" />
            </div>
          )}
        </div>
        <div className="grid gap-2">
          <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-ocean shadow-sm ring-1 ring-line transition hover:bg-slate-50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
            {processing ? <LoaderCircle className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
            {processing ? "Optimizing..." : preview ? "Replace image" : "Add image"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={disabled || processing}
              onChange={handleImageChange}
            />
          </label>
          {preview && (
            <button
              type="button"
              className="h-10 rounded-lg px-4 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={disabled || processing}
              onClick={() => {
                setPreview(null);
                onPendingImageChange(null);
              }}
            >
              Remove image
            </button>
          )}
          <p className="text-xs leading-5 text-slate-500">
            JPG, PNG, or WebP up to 10 MB. Stored as an optimized WebP up to {BUSINESS_IMAGE_MAX_DIMENSION} px and {Math.round(BUSINESS_IMAGE_MAX_STORED_BYTES / 1024)} KB.
          </p>
        </div>
      </div>
    </div>
  );
}
