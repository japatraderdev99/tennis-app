import type { ErrorEnvelope, PublicMetric } from "../api/types";
import { buildFrames, createPainter, type ClipSpec, type PersonSpec, type SynthFrame } from "./synth";
import type { FramePainter } from "../api/client";

export type ScenarioId =
  | "limpo" | "perda" | "cruzamento" | "pes" | "longe" | "camera-lenta" | "falha" | "arquivo" | "conexao";

export interface Scenario {
  id: ScenarioId;
  title: string;
  situation: string;
  recommended?: boolean;
  spec: ClipSpec;
  /** Quadros oferecidos para a seleção, em segundos. */
  seedTimes: number[];
  source_name: string;
  bytes_total: number;
  block?: "player_not_found" | "timing_unreliable";
  feetCut?: boolean;
  failFirstRun?: boolean;
  rejection?: Omit<ErrorEnvelope, "schema_version">;
  interruptAt?: number;
  metric?: "research_only" | "insufficient_evidence";
}

const still = (x: number, ground: number, height: number): PersonSpec["placement"] =>
  () => ({ x, ground, height, visible: true, detectable: true });

const PORTRAIT = { width: 720, height: 1280 };
const LANDSCAPE = { width: 1280, height: 720 };

const portraitPlayer: PersonSpec = { role: "player", serveAt: 1.2, placement: still(330, 1130, 720) };
const farPerson: PersonSpec = { role: "other", serveAt: null, placement: still(650, 640, 150) };

const baseSpec = (seed: number): ClipSpec => ({
  seed, ...PORTRAIT, duration: 6, people: [portraitPlayer, farPerson], uncertainWrist: [3.05, 3.2],
});

const lerp = (a: number, b: number, u: number) => a + (b - a) * Math.min(1, Math.max(0, u));

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  limpo: {
    id: "limpo", title: "Saque na quadra 2",
    situation: "O jogador aparece inteiro do começo ao fim.",
    recommended: true, source_name: "saque-quadra-2.mp4", bytes_total: 38_000_000,
    spec: baseSpec(11), seedTimes: [0, 2, 5], metric: "research_only",
  },
  perda: {
    id: "perda", title: "Saque e busca da bola",
    situation: "O jogador sai da imagem no meio do vídeo.",
    source_name: "busca-da-bola.mp4", bytes_total: 52_000_000,
    spec: {
      seed: 23, ...LANDSCAPE, duration: 10,
      people: [{
        role: "player", serveAt: 0.8,
        placement: (t) => {
          // Depois do saque, caminha para fora da imagem e volta.
          const x = t < 4.6 ? 520 : t < 6 ? lerp(520, 1500, (t - 4.6) / 1.4) : t < 7.4 ? lerp(1500, 880, (t - 6) / 1.4) : 880;
          return { x, ground: 650, height: 440, visible: x < 1400, detectable: x < 1170 };
        },
      }],
    },
    seedTimes: [0, 8, 9.4],
  },
  cruzamento: {
    id: "cruzamento", title: "Saque com alguém passando",
    situation: "Outra pessoa passa bem na frente do jogador.",
    source_name: "alguem-passando.mp4", bytes_total: 47_000_000,
    spec: {
      seed: 31, ...LANDSCAPE, duration: 9,
      people: [
        { role: "player", serveAt: 4.2, placement: still(560, 650, 440) },
        { role: "other", serveAt: null, placement: (t) => {
          // Caminha pela imagem e fica à direita. Mesmo porte: as caixas chegam a coincidir.
          const x = t < 3.4 ? lerp(120, 1040, (t - 0.6) / 2.8) : 1040;
          return { x, ground: 650, height: 440, visible: true, detectable: true };
        } },
      ],
    },
    seedTimes: [0, 3.8, 5],
  },
  pes: {
    id: "pes", title: "Saque com o celular perto",
    situation: "O celular ficou tão perto que os pés saíram da imagem.",
    source_name: "celular-perto.mp4", bytes_total: 33_000_000,
    spec: { seed: 41, ...PORTRAIT, duration: 6, people: [{ role: "player", serveAt: 1.2, placement: still(320, 1420, 1060) }] },
    seedTimes: [0, 2, 5], feetCut: true, metric: "insufficient_evidence",
  },
  longe: {
    id: "longe", title: "Saque visto de longe",
    situation: "O jogador ficou pequeno demais para eu encontrar.",
    source_name: "de-longe.mp4", bytes_total: 29_000_000,
    spec: {
      seed: 53, ...LANDSCAPE, duration: 6,
      people: [{
        role: "player", serveAt: 1.2,
        placement: () => ({ x: 900, ground: 410, height: 90, visible: true, detectable: false }),
      }],
    },
    seedTimes: [], block: "player_not_found",
  },
  "camera-lenta": {
    id: "camera-lenta", title: "Saque em câmera lenta",
    situation: "O arquivo não traz um tempo confiável para cada quadro.",
    source_name: "camera-lenta.mov", bytes_total: 96_000_000,
    spec: { ...baseSpec(61), reliablePts: false }, seedTimes: [], block: "timing_unreliable",
  },
  falha: {
    id: "falha", title: "Saque durante uma falha",
    situation: "O processamento falha na primeira tentativa, por um motivo técnico.",
    source_name: "falha-tecnica.mp4", bytes_total: 38_000_000,
    spec: baseSpec(71), seedTimes: [0, 2, 5], failFirstRun: true,
  },
  arquivo: {
    id: "arquivo", title: "Treino inteiro, sem cortes",
    situation: "O vídeo é mais longo do que o limite aceito.",
    source_name: "treino-inteiro.mp4", bytes_total: 310_000_000,
    spec: baseSpec(83), seedTimes: [],
    rejection: {
      code: "duration_limit",
      message: "Demo: duração acima do limite técnico.",
      retryable: false,
      details: { limit: "max_duration_seconds", synthetic: true },
    },
  },
  conexao: {
    id: "conexao", title: "Saque enviado com sinal fraco",
    situation: "A internet cai durante o envio.",
    source_name: "sinal-fraco.mp4", bytes_total: 41_000_000,
    spec: baseSpec(97), seedTimes: [0, 2, 5], interruptAt: 0.45,
  },
};

export const SCENARIO_ORDER: ScenarioId[] = [
  "limpo", "perda", "cruzamento", "pes", "longe", "camera-lenta", "falha", "arquivo", "conexao",
];

const cache = new Map<ScenarioId, { frames: SynthFrame[]; painter: FramePainter }>();

export function clipOf(id: ScenarioId) {
  let hit = cache.get(id);
  if (!hit) {
    const spec = SCENARIOS[id].spec;
    const frames = buildFrames(spec);
    hit = { frames, painter: createPainter(spec, frames) };
    cache.set(id, hit);
  }
  return hit;
}

export function frameNear(frames: SynthFrame[], seconds: number): SynthFrame {
  let best = frames[0]!;
  for (const f of frames) {
    if (Math.abs(f.playback_time_s - seconds) < Math.abs(best.playback_time_s - seconds)) best = f;
  }
  return best;
}

/** asset_id determinístico no formato do contrato. Nunca é hash de um arquivo real. */
export function assetIdOf(id: ScenarioId): string {
  const seed = SCENARIOS[id].spec.seed;
  let hex = "";
  let h = seed * 2654435761 >>> 0;
  while (hex.length < 64) {
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    hex += h.toString(16).padStart(8, "0");
  }
  return `sha256:${hex.slice(0, 64)}`;
}

export function metricFor(s: Scenario, assetId: string, evidence: { frame_index: number; pts: number } | null): PublicMetric[] {
  if (!s.metric) return [];
  const research = s.metric === "research_only" && evidence !== null;
  return [{
    metric_id: "front_knee_projected_flexion_peak",
    definition_version: "0.1.0",
    status: research ? "research_only" : "insufficient_evidence",
    value: null,
    unit: "deg",
    measurement_space: "image_2d_projected",
    body_side: research ? "left" : null,
    phase_id: "serve_preparation",
    validation_ref: null,
    uncertainty: { status: "not_established" },
    quality_reasons: research ? [] : ["ankle_out_of_frame"],
    evidence: research ? [{ asset_id: assetId, frame_index: evidence.frame_index, pts: evidence.pts }] : [],
    attempts: research ? { total: 1, valid: 1, rejected: 0 } : { total: 1, valid: 0, rejected: 1 },
    pipeline_ref: "demo:simulated_no_inference",
  }];
}
