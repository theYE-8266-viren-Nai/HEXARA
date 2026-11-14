/**
 * Simulated motion-sensor readings for the legs and the back. Deterministic for a given seed and
 * person, so a demo shows the same values each time. Movement context only: these numbers do not
 * assess muscle strength, bone health, injury or back pain.
 */
export interface MotionReading { label: string; value: string; usual: string; note: string }
export interface MotionReadings { legs: MotionReading[]; back: MotionReading[] }

function random(seed: number, key: string): () => number {
  let state = seed >>> 0;
  for (const char of key) state = Math.imul(state ^ char.charCodeAt(0), 2654435761) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function motionReadings(seed: number, personKey: string): MotionReadings {
  const next = random(seed, personKey);
  const between = (low: number, high: number) => Math.round(low + next() * (high - low));
  const exercise = between(95, 135);
  const reps = between(11, 15);
  const left = between(47, 53);
  const sway = between(8, 14);
  const upright = between(78, 92);
  const bend = between(48, 62);
  const pauses = between(3, 7);
  return {
    legs: [
      { label: "Leg exercise today", value: `${exercise} min`, usual: "usual 120 min", note: "Treadmill and cycle time detected by the thigh sensors" },
      { label: "Sit-to-stand repetitions", value: `${reps} in 30 s`, usual: "usual 13", note: "Counted from the up-down movement of each thigh" },
      { label: "Left / right balance", value: `${left}% · ${100 - left}%`, usual: "usual 50% · 50%", note: "Share of movement on each leg" },
      { label: "Standing steadiness", value: `${sway} mm sway`, usual: "usual 11 mm", note: "Small wobbles while standing still with foot restraints" },
    ],
    back: [
      { label: "Upright posture", value: `${upright}% of work time`, usual: "usual 86%", note: "Time the lower back stays in a neutral position" },
      { label: "Forward bending range", value: `${bend}°`, usual: "usual 55°", note: "Largest comfortable bend measured by the lower-back sensor" },
      { label: "Long still periods", value: `${pauses} today`, usual: "usual 5", note: "Stretches of more than 45 minutes without moving the back" },
    ],
  };
}
