export function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function statusTone(status: string): "neutral" | "success" | "warning" | "danger" {
  if (["COMPLETED", "DELIVERED", "ACCEPTED", "CONFIRMED", "READY"].includes(status)) return "success";
  if (["FAILED", "CANCELLED", "REFUNDED", "NO_SHOW"].includes(status)) return "danger";
  if (["NEW", "PENDING", "REQUESTED", "PREPARING", "IN_PROGRESS"].includes(status)) return "warning";
  return "neutral";
}
