import { kycAllowedContentTypes, kycMaxDocumentBytes } from "@/lib/kyc";

export function parseKycDocumentDataUrl(dataUrl: string, expectedContentType: string) {
  const match = dataUrl.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new Error("Upload a valid PDF or image file.");
  }

  const [, contentType, base64] = match;
  if (contentType !== expectedContentType) {
    throw new Error("The uploaded file type does not match the submitted document type.");
  }

  if (!kycAllowedContentTypes.includes(contentType as (typeof kycAllowedContentTypes)[number])) {
    throw new Error("Upload a PDF, JPG, PNG, or WebP document.");
  }

  const data = Buffer.from(base64, "base64");
  if (data.byteLength <= 0) {
    throw new Error("The uploaded document is empty.");
  }
  if (data.byteLength > kycMaxDocumentBytes) {
    throw new Error("Upload each KYC document as a file smaller than 5 MB.");
  }

  return {
    contentType,
    data,
    fileSize: data.byteLength
  };
}
