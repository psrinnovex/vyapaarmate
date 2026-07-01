export const BUSINESS_IMAGE_MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export const BUSINESS_IMAGE_MAX_STORED_BYTES = 350 * 1024;
export const BUSINESS_IMAGE_MAX_DIMENSION = 640;

type BusinessImageReference = {
  id: string;
  logoUrl: string | null;
  logoImage?: { updatedAt: Date | string } | null;
};

export function getBusinessLogoUrl(business: BusinessImageReference) {
  if (business.logoImage) {
    const version = new Date(business.logoImage.updatedAt).getTime();
    return `/api/business-images/${encodeURIComponent(business.id)}?v=${version}`;
  }

  return business.logoUrl;
}
