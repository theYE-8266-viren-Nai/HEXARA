import type { ExplainRequest } from "../../supabase/functions/_shared/validate";

const SOURCE_TEXT: Record<ExplainRequest["source"], string> = { simulated: "the simulated wearable", file: "the imported file", bluetooth: "the Bluetooth heart-rate device", api: "the webhook source" };

/** "Resting heart rate" -> "resting heart rate", but keep acronyms such as HRV and SpO₂. */
const phrase = (label: string) => (label === "HRV" || label === "SpO₂" ? label : label.charAt(0).toLowerCase() + label.slice(1));
const join = (parts: string[]) => (parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`);

/**
 * Deterministic, built-in explanation. It is the default and the offline path, and it is what the app
 * falls back to whenever the cloud explanation is unavailable or fails the safety check.
 */
export function templateExplanation(request: ExplainRequest): string {
  const source = SOURCE_TEXT[request.source];
  const sentences: string[] = [];
  if (request.level === "usual" || request.drivers.length === 0) {
    sentences.push(`Your readings from ${source} look close to your own usual pattern.`);
    sentences.push("Keep your routine, and use the optional wellbeing check-in if something feels different.");
  } else {
    const changes = join(request.drivers.map((driver) => `${phrase(driver.metricLabel)} was ${driver.direction}`));
    const size = request.level === "notably_different" ? "noticeably" : "a little";
    sentences.push(`Your readings from ${source} were ${size} different from your own usual pattern.`);
    sentences.push(`${changes.charAt(0).toUpperCase()}${changes.slice(1)}, compared with your own usual range${request.drivers.length > 1 ? ", at the same time" : ""}.`);
    sentences.push("The optional wellbeing check-in may help. If the change continues, gets worse, or is concerning, tell the crew medic.");
  }
  if (request.drivers.some((driver) => driver.metricLabel === "HRV")) sentences.push("HRV is a rough, short-term estimate.");
  if (request.dataQuality === "limited") sentences.push("Data quality was limited, so treat this as rough context.");
  const months = request.monthlyHistory ?? [];
  if (months.length >= 1) {
    const latest = months.at(-1)!;
    const earlier = months.slice(0, -1).filter((month) => month.quality !== "insufficient");
    sentences.push(earlier.length
      ? `${latest.month} was ${latest.personalSummary.charAt(0).toLowerCase()}${latest.personalSummary.slice(1)} compared with the earlier monthly history.`
      : `${latest.month} provides an initial monthly reference; there is not an earlier month to compare yet.`);
  }
  return sentences.join(" ");
}
