const dayMs = 24 * 60 * 60 * 1000;
const hourMs = 60 * 60 * 1000;
const indiaOffsetMs = 330 * 60 * 1000;

function shiftedToIndia(date: Date) {
  return new Date(date.getTime() + indiaOffsetMs);
}

export function startOfBusinessDay(date: Date) {
  const shifted = shiftedToIndia(date);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - indiaOffsetMs);
}

export function addBusinessDays(date: Date, days: number) {
  return new Date(date.getTime() + days * dayMs);
}

export function businessDaysBetween(from: Date, to: Date) {
  return Math.max(0, Math.floor((startOfBusinessDay(to).getTime() - startOfBusinessDay(from).getTime()) / dayMs));
}

export function businessDateKey(date: Date) {
  return shiftedToIndia(date).toISOString().slice(0, 10);
}

export function businessDayOfWeek(date: Date) {
  return shiftedToIndia(date).getUTCDay();
}

export function businessDayOfMonth(date: Date) {
  return shiftedToIndia(date).getUTCDate();
}

export function businessMonth(date: Date) {
  return shiftedToIndia(date).getUTCMonth();
}

export function businessHour(date: Date) {
  return shiftedToIndia(date).getUTCHours();
}

export function atBusinessHour(date: Date, hour: number) {
  return new Date(startOfBusinessDay(date).getTime() + hour * hourMs);
}

export function businessWeekdayName(date: Date) {
  return date.toLocaleDateString("en-IN", { weekday: "long", timeZone: "Asia/Kolkata" });
}
