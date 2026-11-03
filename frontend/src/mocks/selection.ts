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

/** Validate one complete selection timeline before composing identities. */
function validateSelection(call: SelectionFrame[], reference: SelectionFrame[]): void {
  if (call.length !== reference.length || call.length === 0) throw new Error("linhas de tempo incompatíveis");
  let started = false;
  let stopped = false;
  let previousIndex = -1;
  let previousPts: number | null = null;
  for (let i = 0; i < call.length; i++) {
    const frame = call[i]!;
    const source = reference[i]!;
    if (!Number.isSafeInteger(frame.frame_index) || frame.frame_index <= previousIndex
        || (frame.pts !== null && !Number.isSafeInteger(frame.pts))) {
      throw new Error("quadro ou PTS inválido na seleção");
    }
    if (frame.pts !== null && previousPts !== null && frame.pts <= previousPts) {
      throw new Error("PTS deve crescer na seleção");
    }
    if (frame.frame_index !== source.frame_index || frame.pts !== source.pts) {
      throw new Error("seleções precisam corresponder aos mesmos quadros e PTS");
    }
    previousIndex = frame.frame_index;
    if (frame.pts !== null) previousPts = frame.pts;
    if (frame.status === "selected") {
      if (stopped || typeof frame.detection_id !== "string" || !frame.detection_id.trim() || frame.reason !== null) {
        throw new Error("seleção inválida ou recuperada sem nova semente");
      }
      started = true;
    } else {
      if (frame.detection_id !== null || typeof frame.reason !== "string" || !frame.reason.trim()) {
        throw new Error("estado sem seleção precisa de motivo, sem identidade");
      }
      if (frame.status === "not_started") {
        if (started) throw new Error("seleção iniciada não pode voltar a not_started");
      } else if (frame.status === "lost" || frame.status === "ambiguous") {
        if (!started) throw new Error("seleção precisa começar com semente válida");
        stopped = true;
      } else {
        throw new Error("estado de seleção inválido");
      }
    }
  }
  if (!started) throw new Error("seleção sem semente aplicada");
}

/**
 * Mock-only composition: calls are in request order, newest last. Once a new
 * explicit seed applies, it owns the remaining interval, including loss and
 * ambiguity. Never revive an older identity because the newer one was lost.
 * The real service will bind these segments to versioned candidate evidence.
 */
export function mergeSelections(calls: SelectionFrame[][]): SelectionFrame[] {
  const first = calls[0];
  if (!first) return [];
  for (const call of calls) validateSelection(call, first);
  return first.map((_, i) => {
    for (let k = calls.length - 1; k >= 0; k--) {
      const frame = calls[k]![i]!;
      if (frame.status !== "not_started") return frame;
    }
    return first[i]!;
  });
}
