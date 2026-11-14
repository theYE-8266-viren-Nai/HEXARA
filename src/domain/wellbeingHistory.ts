const SAMPLE_HISTORY_DAYS = 21;

export function hasSampleHistory(date: Date, today = new Date()): boolean {
  const day = new Date(date); day.setHours(12, 0, 0, 0);
  const currentDay = new Date(today); currentDay.setHours(12, 0, 0, 0);
  const daysAgo = Math.round((currentDay.getTime() - day.getTime()) / 86_400_000);
  return daysAgo > 0 && daysAgo <= SAMPLE_HISTORY_DAYS && daysAgo % 3 !== 0;
}
