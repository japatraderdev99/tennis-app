/**
 * Gerador determinístico do "vídeo" simulado e das poses.
 * Nada aqui vem de atleta, de vídeo real ou de inferência de modelo.
 * Os movimentos são desenhados à mão e servem só para exercitar a interface.
 */
import type { FramePainter } from "../api/client";
import type { Box } from "../api/types";

export const COCO17 = [
  "nose", "left_eye", "right_eye", "left_ear", "right_ear",
  "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
  "left_wrist", "right_wrist", "left_hip", "right_hip", "left_knee",
  "right_knee", "left_ankle", "right_ankle",
] as const;
export type JointName = (typeof COCO17)[number];
type Pt = readonly [number, number];
type Body = Record<Exclude<JointName, "left_eye" | "right_eye" | "left_ear" | "right_ear">, Pt>;

export interface SynthKeypoint {
  name: string;
  x: number | null;
  y: number | null;
  score: null;
  visibility: number;
  presence: number;
}
export interface SynthDetection { detection_id: string; bbox: Box; keypoints: SynthKeypoint[] }
export interface SynthFrame {
  frame_index: number;
  pts: number | null;
  playback_time_s: number;
  display_width: number;
  display_height: number;
  detections: SynthDetection[];
}

export interface PersonSpec {
  role: "player" | "other";
  /** Posição dos pés e altura do corpo, em pixels, para cada instante. */
  placement(t: number): { x: number; ground: number; height: number; visible: boolean; detectable: boolean };
  /** Instante em que o saque começa. Null mantém a pessoa parada. */
  serveAt: number | null;
}

export interface ClipSpec {
  seed: number;
  width: number;
  height: number;
  duration: number;
  people: PersonSpec[];
  reliablePts?: boolean;
  /** Janela em que o punho do golpe fica incerto, como acontece perto do contato. */
  uncertainWrist?: [number, number];
}

const READY: Body = {
  nose: [0.02, 0.93], left_shoulder: [0.03, 0.78], right_shoulder: [-0.03, 0.78],
  left_elbow: [0.1, 0.62], right_elbow: [0, 0.6], left_wrist: [0.2, 0.62], right_wrist: [0.12, 0.6],
  left_hip: [0.02, 0.48], right_hip: [-0.03, 0.48], left_knee: [0.06, 0.25], right_knee: [-0.04, 0.25],
  left_ankle: [0.08, 0.02], right_ankle: [-0.1, 0.02],
};
const TOSS: Body = {
  ...READY,
  left_elbow: [0.12, 0.86], left_wrist: [0.16, 1.05], right_elbow: [-0.16, 0.66], right_wrist: [-0.22, 0.52],
};
const TROPHY: Body = {
  nose: [-0.02, 0.84], left_shoulder: [0, 0.7], right_shoulder: [-0.06, 0.68],
  left_elbow: [0.06, 0.88], left_wrist: [0.1, 1.06], right_elbow: [-0.2, 0.76], right_wrist: [-0.16, 0.92],
  left_hip: [-0.04, 0.4], right_hip: [-0.08, 0.4], left_knee: [0.08, 0.24], right_knee: [-0.02, 0.22],
  left_ankle: [0.06, 0.02], right_ankle: [-0.12, 0.02],
};
const CONTACT: Body = {
  nose: [0.08, 1.02], left_shoulder: [0.08, 0.87], right_shoulder: [0.04, 0.89],
  left_elbow: [0.12, 0.72], left_wrist: [0.1, 0.6], right_elbow: [0.1, 1.06], right_wrist: [0.14, 1.22],
  left_hip: [0.03, 0.56], right_hip: [-0.01, 0.56], left_knee: [0.03, 0.32], right_knee: [-0.06, 0.33],
  left_ankle: [0, 0.09], right_ankle: [-0.12, 0.13],
};
const FOLLOW: Body = {
  nose: [0.2, 0.86], left_shoulder: [0.18, 0.72], right_shoulder: [0.22, 0.72],
  left_elbow: [0.12, 0.62], left_wrist: [0.06, 0.52], right_elbow: [0.3, 0.56], right_wrist: [0.22, 0.38],
  left_hip: [0.12, 0.46], right_hip: [0.12, 0.46], left_knee: [0.18, 0.24], right_knee: [0.02, 0.3],
  left_ankle: [0.22, 0.02], right_ankle: [-0.06, 0.12],
};

const KEYS: readonly [number, Body][] = [
  [0, READY], [1, TOSS], [1.7, TROPHY], [1.95, CONTACT], [2.4, FOLLOW], [3.6, READY],
];

const smooth = (u: number) => u * u * (3 - 2 * u);

function bodyAt(serveT: number | null): Body {
  if (serveT === null || serveT <= 0 || serveT >= 3.6) return READY;
  for (let i = 1; i < KEYS.length; i++) {
    const a = KEYS[i - 1]!;
    const b = KEYS[i]!;
    if (serveT <= b[0]) {
      const u = smooth((serveT - a[0]) / (b[0] - a[0]));
      const out = {} as Record<string, Pt>;
      for (const k of Object.keys(a[1]) as (keyof Body)[]) {
        const pa = a[1][k];
        const pb = b[1][k];
        out[k] = [pa[0] + (pb[0] - pa[0]) * u, pa[1] + (pb[1] - pa[1]) * u];
      }
      return out as Body;
    }
  }
  return READY;
}

/** Hash determinístico em [-1, 1]. */
function noise(seed: number, frame: number, channel: number): number {
  let h = (seed * 2654435761 + frame * 40503 + channel * 2147483647) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 3266489917) >>> 0;
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967295) * 2 - 1;
}

function toPixels(body: Body, x: number, ground: number, height: number) {
  const out = {} as Record<keyof Body, { x: number; y: number }>;
  for (const k of Object.keys(body) as (keyof Body)[]) {
    out[k] = { x: x + body[k][0] * height, y: ground - body[k][1] * height };
  }
  return out;
}

export function buildFrames(spec: ClipSpec): SynthFrame[] {
  const frames: SynthFrame[] = [];
  const reliable = spec.reliablePts !== false;
  let pts = 1001; // PTS inicial diferente de zero, como no contrato.
  let index = 0;
  let t = 0;
  while (t < spec.duration) {
    const detections: SynthDetection[] = [];
    spec.people.forEach((person, personIndex) => {
      const place = person.placement(t);
      if (!place.visible || !place.detectable) return;
      const body = toPixels(bodyAt(person.serveAt === null ? null : t - person.serveAt), place.x, place.ground, place.height);
      const jitter = place.height * 0.004;
      const kp: SynthKeypoint[] = COCO17.map((name, c) => {
        const base = name in body
          ? body[name as keyof Body]
          : faceOffset(name, body.nose, place.height);
        const inWindow = person.role === "player" && name === "right_wrist" && spec.uncertainWrist
          && t >= spec.uncertainWrist[0] && t <= spec.uncertainWrist[1];
        return {
          name,
          x: base.x + noise(spec.seed + personIndex, index, c * 2) * jitter,
          y: base.y + noise(spec.seed + personIndex, index, c * 2 + 1) * jitter,
          score: null,
          visibility: inWindow ? 0.1 : 0.95,
          presence: 0.99,
        };
      });
      detections.push({ detection_id: "", bbox: boxOf(kp), keypoints: kp });
    });
    // IDs valem só dentro do quadro: a ordem muda de propósito para provar que não são identidade.
    if (index % 7 === 3) detections.reverse();
    detections.forEach((d, i) => { d.detection_id = String(i); });

    frames.push({
      frame_index: index,
      pts: reliable ? pts : null,
      playback_time_s: t,
      display_width: spec.width,
      display_height: spec.height,
      detections,
    });
    // Intervalos levemente irregulares: a interface precisa respeitar o PTS.
    const delta = 3000 + Math.round(noise(spec.seed, index, 99) * 30);
    pts += delta;
    t += delta / 90000;
    index += 1;
  }
  return frames;
}

function faceOffset(name: string, nose: { x: number; y: number }, h: number) {
  const dx = name.includes("left") ? 0.012 : -0.012;
  const far = name.includes("ear") ? 2 : 1;
  return { x: nose.x + dx * far * h, y: nose.y - 0.012 * h };
}

function boxOf(kp: SynthKeypoint[]): Box {
  const xs = kp.map((k) => k.x as number);
  const ys = kp.map((k) => k.y as number);
  const pad = 8;
  return {
    x1: Math.min(...xs) - pad, y1: Math.min(...ys) - pad - 12,
    x2: Math.max(...xs) + pad, y2: Math.max(...ys) + pad,
  };
}

// --- Pintura do vídeo simulado ---------------------------------------------

const SHIRT = { player: "#17315E", other: "#EDEDE4" };
const SHORTS = { player: "#F2F2EA", other: "#3D4A52" };
const SKIN = { player: "#7A4A32", other: "#C99672" };

function capsule(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, w: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function paintPerson(ctx: CanvasRenderingContext2D, role: "player" | "other", p: Record<keyof Body, { x: number; y: number }>, h: number, withRacket: boolean) {
  const limb = h * 0.042;
  const leg = h * 0.055;
  capsule(ctx, p.left_shoulder, p.left_elbow, limb, SKIN[role]);
  capsule(ctx, p.left_elbow, p.left_wrist, limb * 0.85, SKIN[role]);
  capsule(ctx, p.right_hip, p.right_knee, leg, SKIN[role]);
  capsule(ctx, p.right_knee, p.right_ankle, leg * 0.8, SKIN[role]);
  capsule(ctx, p.left_hip, p.left_knee, leg, SKIN[role]);
  capsule(ctx, p.left_knee, p.left_ankle, leg * 0.8, SKIN[role]);
  capsule(ctx, { x: p.left_ankle.x, y: p.left_ankle.y }, { x: p.left_ankle.x + h * 0.05, y: p.left_ankle.y + h * 0.005 }, leg * 0.6, "#F5F5F0");
  capsule(ctx, { x: p.right_ankle.x, y: p.right_ankle.y }, { x: p.right_ankle.x + h * 0.05, y: p.right_ankle.y + h * 0.005 }, leg * 0.6, "#F5F5F0");
  const hip = { x: (p.left_hip.x + p.right_hip.x) / 2, y: (p.left_hip.y + p.right_hip.y) / 2 };
  const thigh = { x: (p.left_knee.x + p.right_knee.x + hip.x * 2) / 4, y: (p.left_knee.y + p.right_knee.y + hip.y * 2) / 4 };
  capsule(ctx, hip, thigh, h * 0.11, SHORTS[role]);
  const neck = { x: (p.left_shoulder.x + p.right_shoulder.x) / 2, y: (p.left_shoulder.y + p.right_shoulder.y) / 2 };
  capsule(ctx, neck, hip, h * 0.13, SHIRT[role]);
  capsule(ctx, p.right_shoulder, p.right_elbow, limb, SKIN[role]);
  capsule(ctx, p.right_elbow, p.right_wrist, limb * 0.85, SKIN[role]);
  if (withRacket) {
    const dx = p.right_wrist.x - p.right_elbow.x;
    const dy = p.right_wrist.y - p.right_elbow.y;
    const n = Math.hypot(dx, dy) || 1;
    const end = { x: p.right_wrist.x + (dx / n) * h * 0.2, y: p.right_wrist.y + (dy / n) * h * 0.2 };
    capsule(ctx, p.right_wrist, end, h * 0.012, "#20262B");
    ctx.save();
    ctx.translate(end.x + (dx / n) * h * 0.07, end.y + (dy / n) * h * 0.07);
    ctx.rotate(Math.atan2(dy, dx));
    ctx.beginPath();
    ctx.ellipse(0, 0, h * 0.075, h * 0.055, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,.28)";
    ctx.fill();
    ctx.lineWidth = h * 0.011;
    ctx.strokeStyle = "#20262B";
    ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(p.nose.x, p.nose.y - h * 0.015, h * 0.058, 0, Math.PI * 2);
  ctx.fillStyle = SKIN[role];
  ctx.fill();
}

export function createPainter(spec: ClipSpec, frames: SynthFrame[]): FramePainter {
  const { width: w, height: h } = spec;
  return {
    width: w,
    height: h,
    paint(ctx, frameIndex) {
      const t = frames[frameIndex]?.playback_time_s ?? 0;
      const horizon = h * (w > h ? 0.42 : 0.38);
      // Céu, alambrado e saibro em cores chapadas: é uma ilustração, não uma filmagem.
      ctx.fillStyle = "#9CC4D8";
      ctx.fillRect(0, 0, w, horizon * 0.6);
      ctx.fillStyle = "#3F5C57";
      ctx.fillRect(0, horizon * 0.6, w, horizon * 0.4);
      ctx.strokeStyle = "rgba(255,255,255,.14)";
      ctx.lineWidth = 2;
      for (let x = -h; x < w; x += 34) {
        ctx.beginPath();
        ctx.moveTo(x, horizon * 0.6);
        ctx.lineTo(x + horizon * 0.4, horizon);
        ctx.moveTo(x + horizon * 0.4, horizon * 0.6);
        ctx.lineTo(x, horizon);
        ctx.stroke();
      }
      ctx.fillStyle = "#B9653F";
      ctx.fillRect(0, horizon, w, h - horizon);
      ctx.fillStyle = "rgba(255,255,255,.82)";
      ctx.fillRect(0, h * 0.885, w, Math.max(6, h * 0.008));

      for (const person of spec.people) {
        const place = person.placement(t);
        if (!place.visible) continue;
        const serveT = person.serveAt === null ? null : t - person.serveAt;
        const body = toPixels(bodyAt(serveT), place.x, place.ground, place.height);
        paintPerson(ctx, person.role, body, place.height, person.role === "player");
        if (person.role === "player" && serveT !== null && serveT > 0.7 && serveT < 3) {
          // Bola sobe no lançamento e sai para a direita depois do contato.
          const toss = serveT < 1.95
            ? { x: place.x + 0.15 * place.height, y: place.ground - place.height * (0.9 + 0.42 * Math.sin(((serveT - 0.7) / 1.25) * Math.PI * 0.72)) }
            : { x: place.x + 0.2 * place.height + (serveT - 1.95) * w * 1.6, y: place.ground - place.height * (1.3 - (serveT - 1.95) * 0.5) };
          ctx.beginPath();
          ctx.arc(toss.x, toss.y, place.height * 0.018, 0, Math.PI * 2);
          ctx.fillStyle = "#E4F222";
          ctx.fill();
        }
      }

      // Marca gravada no quadro: um print da tela continua dizendo que é simulado.
      const size = Math.max(26, Math.min(w, h) * 0.05);
      ctx.font = `700 ${size}px "Atkinson Hyperlegible Next Variable", sans-serif`;
      const label = "Vídeo simulado";
      const pad = size * 0.45;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = "rgba(10,20,40,.78)";
      ctx.fillRect(pad, pad, tw + pad * 2, size + pad * 1.2);
      ctx.fillStyle = "#FFFFFF";
      ctx.textBaseline = "middle";
      ctx.fillText(label, pad * 2, pad + (size + pad * 1.2) / 2);
    },
  };
}
