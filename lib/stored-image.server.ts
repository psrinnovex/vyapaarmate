const supportedDataUrl = /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/;

export type ParsedStoredImage = {
  data: Buffer;
  mimeType: "image/webp" | "image/jpeg" | "image/png";
};

export function parseStoredImageDataUrl(value: string, maxBytes: number, tooLargeMessage: string): ParsedStoredImage {
  const match = supportedDataUrl.exec(value);
  if (!match) {
    throw new Error("Upload a JPG, PNG, or WebP image.");
  }

  const mimeType = match[1] as ParsedStoredImage["mimeType"];
  const data = Buffer.from(match[2], "base64");

  if (data.length === 0 || data.length > maxBytes) {
    throw new Error(tooLargeMessage);
  }

  return { data, mimeType };
}
