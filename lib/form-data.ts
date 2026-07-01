export function formString(formData: FormData, key: string, fallback = "") {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : fallback;
}

export function formNumber(formData: FormData, key: string, fallback = 0) {
  const value = Number(formString(formData, key));
  return Number.isFinite(value) ? value : fallback;
}

export function formOptionalNumber(formData: FormData, key: string) {
  const value = formString(formData, key);
  if (!value) return undefined;

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function formChecked(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}
