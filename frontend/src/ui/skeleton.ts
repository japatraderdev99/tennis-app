import type { ReplayKeypoint } from "../api/types";

const BONES: [string, string][] = [
  ["left_shoulder", "right_shoulder"], ["left_shoulder", "left_elbow"], ["left_elbow", "left_wrist"],
  ["right_shoulder", "right_elbow"], ["right_elbow", "right_wrist"], ["left_shoulder", "left_hip"],
  ["right_shoulder", "right_hip"], ["left_hip", "right_hip"], ["left_hip", "left_knee"],
  ["left_knee", "left_ankle"], ["right_hip", "right_knee"], ["right_knee", "right_ankle"],
];

type Drawable = { x: number; y: number };
const known = (k: ReplayKeypoint | undefined): k is ReplayKeypoint & Drawable =>
  !!k && k.x !== null && k.y !== null;

/** Ossos que podem ser desenhados. Ponto nulo some, nunca vira (0, 0). */
export function drawableBones(points: ReplayKeypoint[]): [Drawable, Drawable][] {
  const byName = new Map(points.map((k) => [k.name, k]));
  const out: [Drawable, Drawable][] = [];
  for (const [a, b] of BONES) {
    const pa = byName.get(a);
    const pb = byName.get(b);
    if (known(pa) && known(pb)) out.push([pa, pb]);
  }
  return out;
}

export function paintSkeleton(ctx: CanvasRenderingContext2D, points: ReplayKeypoint[], unit: number) {
  const bones = drawableBones(points);
  ctx.lineCap = "round";
  for (const [width, color] of [[unit * 2.2, "#0C2A63"], [unit, "#E4F222"]] as const) {
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    for (const [a, b] of bones) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  for (const k of points) {
    if (!known(k) || /eye|ear/.test(k.name)) continue;
    ctx.beginPath();
    ctx.arc(k.x, k.y, unit * 1.15, 0, Math.PI * 2);
    ctx.fillStyle = "#E4F222";
    ctx.fill();
    ctx.lineWidth = unit * 0.55;
    ctx.strokeStyle = "#0C2A63";
    ctx.stroke();
  }
}
