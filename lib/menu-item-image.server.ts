import { MENU_ITEM_IMAGE_MAX_STORED_BYTES } from "@/lib/menu-item-image";
import { parseStoredImageDataUrl, type ParsedStoredImage } from "@/lib/stored-image.server";

export type ParsedMenuItemImage = ParsedStoredImage;

export function parseMenuItemImageDataUrl(value: string): ParsedMenuItemImage {
  return parseStoredImageDataUrl(value, MENU_ITEM_IMAGE_MAX_STORED_BYTES, "The optimized image must be 500 KB or smaller.");
}
