/**
 * Tipos da fronteira com o backend.
 *
 * "CONTRATO" espelha docs/CONTRACTS_V0.md e P2_POSE_LAB.md (congelados).
 * "PROPOSTA" ainda não existe no backend: é o pedido de mudança descrito em
 * 07-Claude/UX-UI-V1/05-Handoff-Codex.md e precisa de revisão conjunta.
 */

// --- CONTRATO: estados ---------------------------------------------------
export type AssetState = "importing" | "ready" | "rejected";
export type RunState = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type SelectionStatus = "not_started" | "selected" | "lost" | "ambiguous";

// --- CONTRATO: envelope de erro ------------------------------------------
export interface ErrorEnvelope {
  schema_version: "0.1.0";
  code: string;
  message: string;
  retryable: boolean;
  details: Record<string, unknown>;
}

// --- CONTRATO: PublicReport ----------------------------------------------
export interface PublicMetric {
  metric_id: "front_knee_projected_flexion_peak";
  definition_version: "0.1.0";
  status: "research_only" | "insufficient_evidence" | "unsupported";
  /** Sempre null. A interface nunca lê um número daqui. */
  value: null;
  unit: "deg";
  measurement_space: "image_2d_projected";
  body_side: "left" | "right" | null;
  phase_id: "serve_preparation";
  validation_ref: null;
  uncertainty: { status: "not_established" };
  quality_reasons: string[];
  evidence: { asset_id: string; frame_index: number; pts: number }[];
  attempts: { total: number; valid: number; rejected: number };
  pipeline_ref: string;
}

export interface PublicReport {
  schema_version: "0.1.0";
  report_id: string;
  session_id: string;
  run_id: string;
  asset_id: string;
  is_demo: boolean;
  execution: { state: "succeeded" | "failed" | "cancelled" };
  metrics: PublicMetric[];
  comparison: { state: "not_evaluated"; delta: null; reason: string };
  message: string;
  error: ErrorEnvelope | null;
}

// --- PROPOSTA: etapas reais do processamento (sem porcentagem) -----------
export type RunStage = "queued" | "pose_estimation" | "target_association" | "packaging";

export interface Run {
  run_id: string;
  state: RunState;
  stage: RunStage | null;
  error: ErrorEnvelope | null;
}

// --- PROPOSTA: envio retomável -------------------------------------------
export interface UploadProgress {
  state: "sending" | "interrupted" | "done";
  bytes_sent: number;
  bytes_total: number;
}

// --- PROPOSTA: avaliação de captura, independente da execução ------------
export type CaptureIssueCode =
  | "feet_out_of_frame"
  | "player_lost"
  | "player_ambiguous"
  | "player_gap"
  | "player_not_found"
  | "timing_unreliable";

export interface CaptureIssue {
  code: CaptureIssueCode;
  /** Primeiro quadro em que o problema foi observado. Null quando vale para o vídeo inteiro. */
  frame_index: number | null;
  /** Último quadro do trecho. Null quando o trecho não termina no vídeo. */
  end_frame_index: number | null;
  /** Códigos de origem no backend, para rastrear de onde veio a mensagem. */
  source_reasons: string[];
}

export interface CaptureAssessment {
  /** "no_issue_detected" não afirma que a captura é boa; o critério não foi validado. */
  state: "not_assessed" | "no_issue_detected" | "limited" | "not_analyzable";
  issues: CaptureIssue[];
}

// --- PROPOSTA: candidatos para a seleção explícita -----------------------
export interface Box { x1: number; y1: number; x2: number; y2: number }

export interface SeedFrame {
  frame_index: number;
  pts: number;
  detections: { detection_id: string; bbox: Box }[];
}

export interface SeedOptions {
  /** Preenchido quando a seleção é impossível. A pessoa ainda pode rever o vídeo. */
  blocked: CaptureIssue | null;
  frames: SeedFrame[];
}

export interface Seed { frame_index: number; detection_id: string }

// --- PROPOSTA: replay público --------------------------------------------
/** x/y nulos significam "não desenhar". Score, visibility e presence não saem do backend. */
export interface ReplayKeypoint { name: string; x: number | null; y: number | null }

export interface ReplayFrame {
  frame_index: number;
  /** Null quando o vídeo não tem PTS confiável. Nunca é fabricado a partir do FPS. */
  pts: number | null;
  /** Relógio do player, usado só para reprodução. Não serve para medir tempo. */
  playback_time_s: number;
  status: SelectionStatus;
  reason: string | null;
  keypoints: ReplayKeypoint[] | null;
}

export interface Replay {
  session_id: string;
  run_id: string | null;
  is_demo: boolean;
  asset_id: string;
  time_base: string;
  display_width: number;
  display_height: number;
  frames: ReplayFrame[];
  capture: CaptureAssessment;
  coverage: { frames_with_skeleton: number; total_frames: number };
  evaluation: { status: "not_evaluated"; reasons: string[] };
  provenance: { adapter: string; adapter_version: string; simulated: boolean };
}

// --- PROPOSTA: exclusão (o contrato reserva estes estados para o serviço) --
export type DeletionState = "none" | "access_blocked" | "removing_files" | "deleted";

// --- PROPOSTA: sessão, agregando o que a interface precisa para rotear ---
export interface Session {
  session_id: string;
  created_at: string;
  is_demo: boolean;
  video: { title: string; source_name: string; duration_seconds: number };
  asset_id: string;
  asset_state: AssetState;
  upload: UploadProgress;
  rejection: ErrorEnvelope | null;
  run: Run | null;
  run_count: number;
  capture: CaptureAssessment | null;
  report: PublicReport | null;
  deletion: DeletionState;
}

export interface LocalVideo {
  id: string;
  title: string;
  situation: string;
  duration_seconds: number;
  recommended?: boolean;
}
