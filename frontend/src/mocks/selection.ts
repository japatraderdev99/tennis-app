/**
 * Porte de `select_target` (tennis_backend.selection, método conservative_iou_v0).
 * Usado só pelos mocks. scripts/verify_against_backend.py compara a saída com a
 * implementação Python real, para os mocks não prometerem o que o backend não faz.
 */
import type { Box, SelectionStatus } from "../api/types";

export interface SelectionFrame {
  frame_index: number;
  pts: number | null;
  status: SelectionStatus;
  detection_id: string | null;
  reason: string | null;
}

interface InputFrame {
  frame_index: number;
  pts: number | null;
  detections: { detection_id: string; bbox: Box }[];
}

export function iou(a: Box, b: Box): number {
  const w = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
  const h = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
  if (w <= 0 || h <= 0) return 0;
  const inter = w * h;
  return inter / ((a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - inter);
}

export function selectTarget(
  frames: InputFrame[],
  seed: { frame_index: number; detection_id: string },
  minIou = 0.2,
  margin = 0.05,
): SelectionFrame[] {
  let box: Box | null = null;
  let previous = -1;
  let stopped = false;
  const out: SelectionFrame[] = [];
  for (const frame of frames) {
    let detection_id: string | null = null;
    let status: SelectionStatus;
    let reason: string | null;
    if (frame.frame_index < seed.frame_index) {
      status = "not_started"; reason = "before_seed";
    } else if (frame.frame_index === seed.frame_index) {
      const found = frame.detections.find((d) => d.detection_id === seed.detection_id);
      if (!found) throw new Error("semente precisa existir no quadro");
      box = found.bbox; detection_id = found.detection_id;
      status = "selected"; reason = null;
    } else if (stopped) {
      status = "lost"; reason = "reseed_required";
    } else if (frame.frame_index !== previous + 1) {
      status = "lost"; reason = "frame_gap"; stopped = true;
    } else if (frame.detections.length === 0) {
      status = "lost"; reason = "no_detections"; stopped = true;
    } else {
      const ranked = frame.detections
        .map((d) => ({ d, v: iou(box as Box, d.bbox) }))
        .sort((a, b) => b.v - a.v);
      const best = ranked[0]!;
      const second = ranked[1];
      if (best.v < minIou) {
        status = "lost"; reason = "iou_below_threshold"; stopped = true;
      } else if (second && best.v - second.v <= margin) {
        status = "ambiguous"; reason = "ambiguous_iou"; stopped = true;
      } else {
        box = best.d.bbox; detection_id = best.d.detection_id;
        status = "selected"; reason = null;
      }
    }
    out.push({ frame_index: frame.frame_index, pts: frame.pts, status, detection_id, reason });
    previous = frame.frame_index;
  }
  return out;
}

/**
 * PROPOSTA: cada nova semente é uma chamada separada. O replay mostra, por quadro,
 * a seleção mais recente que acompanhou o jogador; sem nenhuma, mantém o motivo.
 */
export function mergeSelections(calls: SelectionFrame[][]): SelectionFrame[] {
  const first = calls[0];
  if (!first) return [];
  return first.map((_, i) => {
    const entries = calls.map((c) => c[i]!);
    for (let k = entries.length - 1; k >= 0; k--) {
      if (entries[k]!.status === "selected") return entries[k]!;
    }
    // A chamada mais antiga guarda o motivo original da perda.
    return entries.find((e) => e.status !== "not_started") ?? entries[0]!;
  });
}
