/**
 * A built-in synthetic export for demos, so the Import panel can be shown without a real file.
 * It is deliberately messy: bad units, impossible values, a future timestamp, a duplicate,
 * a spike, and an unknown metric, plus a clear last-day change so analysis has something to explain.
 */
export function buildSampleCsv(now: Date = new Date()): string {
  const lines = ["timestamp,metric,value,unit,deviceId,context"];
  const dayMs = 86_400_000;
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (let back = 34; back >= 1; back -= 1) {
    const day = startOfToday - back * dayMs;
    const base = back === 1 ? 84 : 60 + (back % 5);
    for (const hour of [6, 12, 18]) {
      const t = new Date(day + hour * 3_600_000).toISOString();
      lines.push(`${t},heart_rate,${base + (hour === 12 ? 0.4 : 0)},bpm,sample-band,rest`);
    }
    lines.push(`${new Date(day + 9 * 3_600_000).toISOString()},skin_temperature,${(98 + (back % 3) * 0.1).toFixed(1)},F,sample-band,rest`);
  }
  const yesterday = startOfToday - dayMs;
  const at = (hour: number) => new Date(yesterday + hour * 3_600_000).toISOString();
  lines.push(`${at(7)},heart_rate,0,bpm,sample-band,rest`); // lost contact
  lines.push(`${at(8)},heart_rate,400,bpm,sample-band,rest`); // impossible
  lines.push(`${at(6)},heart_rate,${60 + (1 % 5)},bpm,sample-band,rest`); // duplicate of an existing row's timestamp
  lines.push(`${at(10)},blood_sugar,5.2,mmol,sample-band,rest`); // unknown metric
  lines.push(`${new Date(startOfToday + 3 * dayMs).toISOString()},heart_rate,62,bpm,sample-band,rest`); // future
  lines.push(`${at(11)},heart_rate,${"abc"},bpm,sample-band,rest`); // not a number
  lines.push(`${at(15)},heart_rate,this,row,has,too,many,columns`); // malformed row
  return lines.join("\n");
}
