const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CHECKSUM_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function normalizeGstin(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function gstinCheckDigit(value: string) {
  const body = normalizeGstin(value);
  if (body.length !== 14) return null;

  let factor = 2;
  let sum = 0;

  for (let index = body.length - 1; index >= 0; index -= 1) {
    const codePoint = CHECKSUM_CHARS.indexOf(body[index]);
    if (codePoint < 0) return null;

    const product = codePoint * factor;
    sum += Math.floor(product / CHECKSUM_CHARS.length) + (product % CHECKSUM_CHARS.length);
    factor = factor === 2 ? 1 : 2;
  }

  return CHECKSUM_CHARS[(CHECKSUM_CHARS.length - (sum % CHECKSUM_CHARS.length)) % CHECKSUM_CHARS.length];
}

export function isValidGstin(value: string) {
  const gstin = normalizeGstin(value);
  if (!GSTIN_PATTERN.test(gstin)) return false;

  return gstinCheckDigit(gstin.slice(0, 14)) === gstin[14];
}
