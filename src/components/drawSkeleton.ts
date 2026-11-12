import type { Landmark } from "../domain/poseFeatures";

const CONNECTIONS: Array<[number, number]> = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
const POINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

/** Draws the tracked body points on a canvas that sits over the live preview. Nothing is stored. */
export function drawSkeleton(canvas: HTMLCanvasElement | null, landmarks: Landmark[] | null) {
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!landmarks) return;
  const at = (index: number) => ({ x: landmarks[index].x * canvas.width, y: landmarks[index].y * canvas.height, ok: (landmarks[index].visibility ?? 1) >= 0.5 });
  ctx.lineWidth = 3; ctx.strokeStyle = "rgba(85,224,244,.9)"; ctx.fillStyle = "#ffffff";
  for (const [a, b] of CONNECTIONS) { const p = at(a); const q = at(b); if (p.ok && q.ok) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); } }
  for (const index of POINTS) { const p = at(index); if (p.ok) { ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill(); } }
}
