import { BUSINESS_IMAGE_MAX_STORED_BYTES } from "@/lib/business-image";
import { parseStoredImageDataUrl, type ParsedStoredImage } from "@/lib/stored-image.server";

export type ParsedBusinessImage = ParsedStoredImage;

export function parseBusinessImageDataUrl(value: string): ParsedBusinessImage {
  return parseStoredImageDataUrl(value, BUSINESS_IMAGE_MAX_STORED_BYTES, "The optimized business image must be 350 KB or smaller.");
}
