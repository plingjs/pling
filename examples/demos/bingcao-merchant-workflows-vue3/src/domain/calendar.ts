/** Business dates in the demo follow the shop's timezone, independently of the visitor's device. */
export const BUSINESS_TIME_ZONE = "Asia/Shanghai";

export function localDateAt(now: Date, timeZone = BUSINESS_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Return the next N occurrences of a weekday after today in the business timezone. */
export function upcomingWeekdayDates(
  weekday: number,
  count: number,
  now = new Date(),
  timeZone = BUSINESS_TIME_ZONE,
): string[] {
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new Error("weekday must be 0–6");
  if (!Number.isInteger(count) || count < 1 || count > 12) throw new Error("count must be 1–12");

  const today = localDateAt(now, timeZone);
  const [year, month, day] = today.split("-").map(Number);
  const todayUtc = new Date(Date.UTC(year!, month! - 1, day!));
  const difference = (weekday - todayUtc.getUTCDay() + 7) % 7 || 7;
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(todayUtc);
    date.setUTCDate(todayUtc.getUTCDate() + difference + index * 7);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  });
}
