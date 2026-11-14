/**
 * Shared contract for "Explain this pattern". Used by the browser AND the Edge Function, so it must
 * stay pure TypeScript (no Deno, DOM or Node APIs).
 *
 * Only a de-identified summary may leave the device: level, score, up to three drivers, bounded monthly
 * summaries, data quality and source. Everything is an enum or a bounded number, so nothing a user typed
 * can reach the model.
 * Simulated data only. Not medical advice. Not diagnostic.
 */
export const EXPLAIN_STAGES = ["future", "active", "retired"] as const;
export const EXPLAIN_LEVELS = ["usual", "different", "notably_different"] as const;
export const EXPLAIN_SOURCES = ["simulated", "file", "bluetooth", "api"] as const;
export const EXPLAIN_QUALITIES = ["good", "limited"] as const;
export const DRIVER_LABELS = ["Resting heart rate", "HRV", "Sleep", "Skin temperature", "SpO₂", "Radiation dose"] as const;

export interface ExplainDriver { metricLabel: (typeof DRIVER_LABELS)[number]; direction: "higher" | "lower"; changePct: number; }
export const MONTHLY_QUALITIES = ["good", "limited", "insufficient"] as const;
export const MONTHLY_DIRECTIONS = ["usual", "higher", "lower", "insufficient"] as const;
export interface ExplainMonthlyMetric { metricLabel: (typeof DRIVER_LABELS)[number]; average: number; minimum: number; maximum: number; observedDays: number; direction: (typeof MONTHLY_DIRECTIONS)[number]; }
export interface ExplainMonthlySummary { month: string; personalSummary: string; notableDays: number; quality: (typeof MONTHLY_QUALITIES)[number]; metrics: ExplainMonthlyMetric[]; }
export interface ExplainRequest {
  stage: (typeof EXPLAIN_STAGES)[number];
  level: (typeof EXPLAIN_LEVELS)[number];
  patternScore: number;
  drivers: ExplainDriver[];
  dataQuality: (typeof EXPLAIN_QUALITIES)[number];
  source: (typeof EXPLAIN_SOURCES)[number];
  audience: "traveler";
  monthlyHistory?: ExplainMonthlySummary[];
}

export type ValidationResult = { ok: true; value: ExplainRequest } | { ok: false; error: string };

const REQUEST_KEYS = ["stage", "level", "patternScore", "drivers", "dataQuality", "source", "audience", "monthlyHistory"];
const DRIVER_KEYS = ["metricLabel", "direction", "changePct"];
const MONTHLY_KEYS = ["month", "personalSummary", "notableDays", "quality", "metrics"];
const MONTHLY_METRIC_KEYS = ["metricLabel", "average", "minimum", "maximum", "observedDays", "direction"];
const isOneOf = <T extends readonly string[]>(list: T, value: unknown): value is T[number] => typeof value === "string" && (list as readonly string[]).includes(value);
const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Strict validation: unknown keys, unknown labels and out-of-range numbers are all rejected. */
export function validateExplainRequest(body: unknown): ValidationResult {
  if (!isPlainObject(body)) return { ok: false, error: "Body must be an object." };
  const extra = Object.keys(body).filter((key) => !REQUEST_KEYS.includes(key));
  if (extra.length) return { ok: false, error: `Unknown field: ${extra[0]}.` };
  if (!isOneOf(EXPLAIN_STAGES, body.stage)) return { ok: false, error: "Invalid stage." };
  if (!isOneOf(EXPLAIN_LEVELS, body.level)) return { ok: false, error: "Invalid level." };
  if (typeof body.patternScore !== "number" || !Number.isInteger(body.patternScore) || body.patternScore < 0 || body.patternScore > 100) return { ok: false, error: "Invalid patternScore." };
  if (!isOneOf(EXPLAIN_QUALITIES, body.dataQuality)) return { ok: false, error: "Invalid dataQuality." };
  if (!isOneOf(EXPLAIN_SOURCES, body.source)) return { ok: false, error: "Invalid source." };
  if (body.audience !== "traveler") return { ok: false, error: "Invalid audience." };
  if (!Array.isArray(body.drivers) || body.drivers.length > 3) return { ok: false, error: "drivers must be an array of at most 3." };
  const drivers: ExplainDriver[] = [];
  for (const driver of body.drivers) {
    if (!isPlainObject(driver)) return { ok: false, error: "Invalid driver." };
    if (Object.keys(driver).some((key) => !DRIVER_KEYS.includes(key))) return { ok: false, error: "Unknown driver field." };
    if (!isOneOf(DRIVER_LABELS, driver.metricLabel)) return { ok: false, error: "Invalid driver label." };
    if (driver.direction !== "higher" && driver.direction !== "lower") return { ok: false, error: "Invalid driver direction." };
    if (typeof driver.changePct !== "number" || !Number.isFinite(driver.changePct) || Math.abs(driver.changePct) > 500) return { ok: false, error: "Invalid driver changePct." };
    drivers.push({ metricLabel: driver.metricLabel, direction: driver.direction, changePct: driver.changePct });
  }
  let monthlyHistory: ExplainMonthlySummary[] | undefined;
  if (body.monthlyHistory !== undefined) {
    if (!Array.isArray(body.monthlyHistory) || body.monthlyHistory.length > 6) return { ok: false, error: "Invalid monthlyHistory." };
    monthlyHistory = [];
    for (const month of body.monthlyHistory) {
      if (!isPlainObject(month) || Object.keys(month).some((key) => !MONTHLY_KEYS.includes(key)) || typeof month.month !== "string" || !/^\d{4}-\d{2}$/.test(month.month) || typeof month.personalSummary !== "string" || month.personalSummary.length > 180 || typeof month.notableDays !== "number" || !Number.isInteger(month.notableDays) || month.notableDays < 0 || month.notableDays > 31 || !isOneOf(MONTHLY_QUALITIES, month.quality) || !Array.isArray(month.metrics) || month.metrics.length > DRIVER_LABELS.length) return { ok: false, error: "Invalid monthlyHistory month." };
      const metrics: ExplainMonthlyMetric[] = [];
      for (const metric of month.metrics) {
        if (!isPlainObject(metric) || Object.keys(metric).some((key) => !MONTHLY_METRIC_KEYS.includes(key)) || !isOneOf(DRIVER_LABELS, metric.metricLabel) || !isOneOf(MONTHLY_DIRECTIONS, metric.direction) || [metric.average, metric.minimum, metric.maximum].some((value) => typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 100000) || typeof metric.observedDays !== "number" || !Number.isInteger(metric.observedDays) || metric.observedDays < 0 || metric.observedDays > 31) return { ok: false, error: "Invalid monthlyHistory metric." };
        metrics.push({ metricLabel: metric.metricLabel, average: metric.average as number, minimum: metric.minimum as number, maximum: metric.maximum as number, observedDays: metric.observedDays as number, direction: metric.direction });
      }
      monthlyHistory.push({ month: month.month, personalSummary: month.personalSummary, notableDays: month.notableDays, quality: month.quality, metrics });
    }
  }
  return { ok: true, value: { stage: body.stage, level: body.level, patternScore: body.patternScore, drivers, dataQuality: body.dataQuality, source: body.source, audience: "traveler", ...(monthlyHistory ? { monthlyHistory } : {}) } };
}

/** Mirrors NOT_ASSUMED in src/domain/deviceAssumptions.ts (a test keeps the two identical). */
export const NOT_ASSUMED_LINES = [
  "Blood pressure, glucose, or ECG.",
  "Bone density, vision, or blood-clot detection.",
  "Any diagnosis, disease probability, or medical clearance.",
];

const BANNED_PATTERNS: RegExp[] = [
  /\bdiagnos/i, /\bprobab/i, /\bblood[- ]pressure\b/i, /\bglucose\b/i, /\bECG\b|\bEKG\b/i, /\bbone[- ]densit/i, /\bvision\b/i, /\bblood[- ]clot/i,
  /\bclearance\b|\bcleared for\b|\bfit (to|for) fly/i, /\bmedical condition\b/i, /\byou (have|are suffering|are sick|are ill)\b/i,
  /\b(medication|medicine|prescri\w*|treatment|therapy|antibiotic\w*|ibuprofen|aspirin|painkiller\w*)\b/i,
  /\b(disease|infection|illness|syndrome|disorder)\b/i, /\bemergency\b/i, /\bSANS\b/, /\brisk\b/i, /\bmeasur(ed|es|ement)/i,
];

export const MAX_EXPLANATION_CHARS = 700;

/** True when a piece of explanation text is short enough and free of diagnostic, treatment or clearance language. */
export function isSafeExplanation(text: unknown): text is string {
  return typeof text === "string" && text.trim().length > 0 && text.length <= MAX_EXPLANATION_CHARS && !BANNED_PATTERNS.some((pattern) => pattern.test(text));
}

export function buildSystemPrompt(): string {
  return [
    "You rewrite a structured summary of simulated wellbeing readings into 2 to 4 short, plain, calm sentences for a space traveler.",
    "Use ONLY the facts given. Say which signals were higher or lower than the person's own usual range, and by roughly how much.",
    "Call them readings; never say they were measured. Do not guess a cause.",
    "Never diagnose, never name a condition or disease, never give a probability, never mention treatment or medication, and never say anyone is cleared, fit, or unfit to fly.",
    `OrbitWell does not assume and never reports: ${NOT_ASSUMED_LINES.join(" ")}`,
    "Use monthly summaries, when present, to distinguish a short-term change from a repeated month-to-month pattern.",
    "End by suggesting the optional wellbeing check-in, and telling the crew medic if the change continues, gets worse, or is concerning.",
    "Output plain text only: no lists, no markdown, no headings.",
  ].join(" ");
}

export function buildUserPrompt(request: ExplainRequest): string {
  const drivers = request.drivers.length
    ? request.drivers.map((driver) => `- ${driver.metricLabel}: ${driver.direction} than usual by about ${Math.abs(Math.round(driver.changePct))}%`).join("\n")
    : "- No single signal stands out";
  const monthly = request.monthlyHistory?.length ? `\nMonthly personal history (summary only):\n${request.monthlyHistory.map((month) => `${month.month}: ${month.personalSummary}; notable days ${month.notableDays}; quality ${month.quality}; ${month.metrics.map((metric) => `${metric.metricLabel} average ${metric.average}, range ${metric.minimum}-${metric.maximum}, ${metric.direction}`).join(" | ")}`).join("\n")}` : "";
  return [
    `Stage: ${request.stage}`,
    `Pattern level: ${request.level.replace("_", " ")} (score ${request.patternScore} of 100)`,
    `Data quality: ${request.dataQuality}`,
    `Source: ${request.source}`,
    "Signals that changed together:",
    drivers,
    monthly,
  ].join("\n");
}
