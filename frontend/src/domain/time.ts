import type { ReplayFrame } from "../api/types";

/** Segundos desde o primeiro quadro, sempre a partir de PTS × time_base. Null se não houver PTS. */
export function secondsFromPts(pts: number | null, firstPts: number | null, timeBase: string): number | null {
  if (pts === null || firstPts === null) return null;
  const [n, d] = timeBase.split("/").map(Number);
  if (!n || !d) return null;
  return ((pts - firstPts) * n) / d;
}

/** "0:03,2". Valor ausente nunca vira zero. */
export function formatClock(seconds: number | null): string {
  if (seconds === null) return "sem tempo confiável";
  const total = Math.max(0, seconds);
  const min = Math.floor(total / 60);
  const sec = Math.floor(total % 60);
  const tenth = Math.floor((total * 10) % 10);
  return `${min}:${String(sec).padStart(2, "0")},${tenth}`;
}

/** Último quadro cujo relógio de reprodução já começou. */
export function frameAtTime(frames: Pick<ReplayFrame, "playback_time_s">[], t: number): number {
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (frames[mid]!.playback_time_s <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export interface Segment { from: number; to: number; tracked: boolean }

/** Trechos da linha do tempo, em fração do vídeo. */
export function trackSegments(frames: ReplayFrame[]): Segment[] {
  if (!frames.length) return [];
  const total = frames[frames.length - 1]!.playback_time_s || 1;
  const out: Segment[] = [];
  for (const f of frames) {
    const tracked = f.keypoints !== null;
    const at = f.playback_time_s / total;
    const last = out[out.length - 1];
    if (last && last.tracked === tracked) last.to = at;
    else {
      if (last) last.to = at;
      out.push({ from: at, to: at, tracked });
    }
  }
  out[out.length - 1]!.to = 1;
  return out;
}

export function formatBytes(bytes: number): string {
  return `${Math.round(bytes / 1_000_000)} MB`;
}
