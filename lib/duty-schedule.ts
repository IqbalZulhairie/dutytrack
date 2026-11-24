export function getOneYearLater(dateValue: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return "";
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateValue) return "";
  if (date.getUTCFullYear() >= 9999) return "9999-12-31";

  const startMonth = date.getUTCMonth();
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  if (date.getUTCMonth() !== startMonth) date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}

export function getDutyDates(startDate: string, endDate: string, repeatDays: number[]) {
  if (!repeatDays.length) return [startDate];

  const date = new Date(`${startDate}T00:00:00.000Z`);
  const lastDate = new Date(`${endDate}T00:00:00.000Z`);
  const dates: string[] = [];
  while (date <= lastDate) {
    if (repeatDays.includes(date.getUTCDay())) dates.push(date.toISOString().slice(0, 10));
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return dates;
}
