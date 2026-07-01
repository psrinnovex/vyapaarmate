import {
  BUSINESS_IMAGE_MAX_DIMENSION,
  BUSINESS_IMAGE_MAX_SOURCE_BYTES,
  BUSINESS_IMAGE_MAX_STORED_BYTES
} from "@/lib/business-image";
import {
  MENU_ITEM_IMAGE_MAX_DIMENSION,
  MENU_ITEM_IMAGE_MAX_SOURCE_BYTES,
  MENU_ITEM_IMAGE_MAX_STORED_BYTES
} from "@/lib/menu-item-image";

const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not optimize this image."))),
      "image/webp",
      quality
    );
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read this image."));
    reader.readAsDataURL(blob);
  });
}

async function optimizeImageFile(
  file: File,
  options: {
    maxDimension: number;
    maxSourceBytes: number;
    maxStoredBytes: number;
    tooLargeMessage: string;
    tooDetailedMessage: string;
  }
) {
  if (!acceptedImageTypes.has(file.type)) {
    throw new Error("Choose a JPG, PNG, or WebP image.");
  }
  if (file.size > options.maxSourceBytes) {
    throw new Error(options.tooLargeMessage);
  }

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  let scale = Math.min(1, options.maxDimension / Math.max(bitmap.width, bitmap.height));
  let quality = 0.82;

  try {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));

      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not optimize this image.");

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const blob = await canvasToBlob(canvas, quality);
      if (blob.size <= options.maxStoredBytes) {
        return blobToDataUrl(blob);
      }

      if (quality > 0.62) quality -= 0.08;
      else scale *= 0.82;
    }
  } finally {
    bitmap.close();
  }

  throw new Error(options.tooDetailedMessage);
}

export async function optimizeMenuItemImage(file: File) {
  return optimizeImageFile(file, {
    maxDimension: MENU_ITEM_IMAGE_MAX_DIMENSION,
    maxSourceBytes: MENU_ITEM_IMAGE_MAX_SOURCE_BYTES,
    maxStoredBytes: MENU_ITEM_IMAGE_MAX_STORED_BYTES,
    tooLargeMessage: "Choose an image smaller than 10 MB.",
    tooDetailedMessage: "This image is too detailed. Choose a simpler or smaller photo."
  });
}

export async function optimizeBusinessImage(file: File) {
  return optimizeImageFile(file, {
    maxDimension: BUSINESS_IMAGE_MAX_DIMENSION,
    maxSourceBytes: BUSINESS_IMAGE_MAX_SOURCE_BYTES,
    maxStoredBytes: BUSINESS_IMAGE_MAX_STORED_BYTES,
    tooLargeMessage: "Choose an image smaller than 10 MB.",
    tooDetailedMessage: "This business image is too detailed. Choose a simpler or smaller photo."
  });
}
