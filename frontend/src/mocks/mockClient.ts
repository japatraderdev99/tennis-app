/**
 * Implementação simulada de ApiClient.
 * O estado é derivado do relógio no momento da leitura, como numa consulta ao
 * servidor: recarregar a página não perde nem adianta nada.
 */
import type { ApiClient, FramePainter } from "../api/client";
import type {
  CaptureAssessment, CaptureIssue, DeletionState, ErrorEnvelope, LocalVideo, PublicReport,
  Replay, ReplayFrame, Run, RunStage, Seed, SeedOptions, Session, UploadProgress,
} from "../api/types";
import { assetIdOf, clipOf, frameNear, metricFor, SCENARIO_ORDER, SCENARIOS, type ScenarioId } from "./scenarios";
import { mergeSelections, selectTarget, type SelectionFrame } from "./selection";

interface RunRecord { run_id: string; seeds: Seed[]; startedAt: number; cancelledAt: number | null; failing: boolean }
interface Record_ {
  id: string;
  scenario: ScenarioId;
  createdAt: number;
  uploadStartedAt: number;
  resumedAt: number | null;
  runs: RunRecord[];
  deletionAt: number | null;
  flags: number[];
}
interface Stored { counter: number; sessions: Record_[] }

const KEY = "quadro.demo.v1";
const STAGE_MS: [RunStage, number][] = [
  ["queued", 1400], ["pose_estimation", 3200], ["target_association", 2000], ["packaging", 1400],
];
const UPLOAD_MS = 3000;
const DELETE_MS = { access_blocked: 1200, removing_files: 2400 };

export interface Storage_ { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

function memoryStorage(): Storage_ {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

export function createMockClient(opts: { speed?: number; storage?: Storage_; now?: () => number } = {}): ApiClient & {
  resetAll(): void;
  seedLab(scenario: ScenarioId, target: "selecting" | "processing" | "done"): Promise<string>;
} {
  const speed = opts.speed ?? 1;
  const storage = opts.storage ?? (typeof localStorage === "undefined" ? memoryStorage() : localStorage);
  const now = opts.now ?? (() => Date.now());

  const load = (): Stored => {
    try {
      const raw = storage.getItem(KEY);
      if (raw) return JSON.parse(raw) as Stored;
    } catch { /* estado corrompido recomeça vazio */ }
    return { counter: 0, sessions: [] };
  };
  const save = (s: Stored) => storage.setItem(KEY, JSON.stringify(s));
  const update = (id: string, fn: (r: Record_) => void) => {
    const s = load();
    const r = s.sessions.find((x) => x.id === id);
    if (!r) throw new Error("Sessão não encontrada");
    fn(r);
    save(s);
  };
  const find = (id: string): Record_ => {
    const r = load().sessions.find((x) => x.id === id);
    if (!r) throw new Error("Sessão não encontrada");
    return r;
  };

  const uploadOf = (r: Record_): UploadProgress => {
    const s = SCENARIOS[r.scenario];
    const total = s.bytes_total;
    const stopAt = s.interruptAt;
    let fraction = (now() - r.uploadStartedAt) / (UPLOAD_MS * speed);
    let state: UploadProgress["state"] = "sending";
    if (stopAt !== undefined) {
      if (r.resumedAt === null) {
        if (fraction >= stopAt) { fraction = stopAt; state = "interrupted"; }
      } else {
        fraction = stopAt + (now() - r.resumedAt) / (UPLOAD_MS * speed);
      }
    }
    if (fraction >= 1) { fraction = 1; state = "done"; }
    return { state, bytes_sent: Math.round(total * Math.max(0, fraction)), bytes_total: total };
  };

  const runOf = (r: Record_): Run | null => {
    const rec = r.runs[r.runs.length - 1];
    if (!rec) return null;
    if (rec.cancelledAt !== null) return { run_id: rec.run_id, state: "cancelled", stage: null, error: null };
    let left = now() - rec.startedAt;
    for (const [stage, ms] of STAGE_MS) {
      const scaled = ms * speed;
      if (rec.failing && stage === "pose_estimation" && left >= scaled * 0.6) {
        const error: ErrorEnvelope = {
          schema_version: "0.1.0", code: "worker_interrupted",
          message: "Demo: processamento interrompido.", retryable: true,
          details: { stage: "pose_estimation", synthetic: true },
        };
        return { run_id: rec.run_id, state: "failed", stage: null, error };
      }
      if (left < scaled) {
        return { run_id: rec.run_id, state: stage === "queued" ? "queued" : "running", stage, error: null };
      }
      left -= scaled;
    }
    return { run_id: rec.run_id, state: "succeeded", stage: null, error: null };
  };

  const selectionOf = (r: Record_): SelectionFrame[] => {
    const frames = clipOf(r.scenario).frames;
    const rec = r.runs[r.runs.length - 1];
    return mergeSelections((rec?.seeds ?? []).map((seed) => selectTarget(frames, seed)));
  };

  const captureOf = (r: Record_): CaptureAssessment => {
    const s = SCENARIOS[r.scenario];
    if (s.block) {
      const issue: CaptureIssue = {
        code: s.block, frame_index: null, end_frame_index: null,
        source_reasons: s.block === "player_not_found" ? ["no_detections"] : ["missing_pts"],
      };
      return { state: "not_analyzable", issues: [issue] };
    }
    const issues: CaptureIssue[] = [];
    if (s.feetCut) {
      issues.push({ code: "feet_out_of_frame", frame_index: 0, end_frame_index: null, source_reasons: ["ankle_out_of_frame"] });
    }
    const sel = selectionOf(r);
    for (let i = 0; i < sel.length; i++) {
      const f = sel[i]!;
      if (f.status !== "lost" && f.status !== "ambiguous") continue;
      let end = i;
      while (end + 1 < sel.length && (sel[end + 1]!.status === "lost" || sel[end + 1]!.status === "ambiguous")) end++;
      const open = end === sel.length - 1;
      issues.push({
        code: !open ? "player_gap" : f.status === "ambiguous" ? "player_ambiguous" : "player_lost",
        frame_index: f.frame_index,
        end_frame_index: open ? null : sel[end]!.frame_index,
        source_reasons: f.reason ? [f.reason] : [],
      });
      i = end;
    }
    return { state: issues.length ? "limited" : "no_issue_detected", issues };
  };

  const reportOf = (r: Record_, run: Run): PublicReport | null => {
    if (run.state !== "succeeded" && run.state !== "failed" && run.state !== "cancelled") return null;
    const s = SCENARIOS[r.scenario];
    const asset_id = assetIdOf(r.scenario);
    const sel = selectionOf(r);
    const firstOk = sel.find((f) => f.status === "selected" && f.pts !== null);
    const succeeded = run.state === "succeeded";
    return {
      schema_version: "0.1.0",
      report_id: `demo-report-${run.run_id}`,
      session_id: r.id,
      run_id: run.run_id,
      asset_id,
      is_demo: true,
      execution: { state: run.state },
      metrics: succeeded ? metricFor(s, asset_id, firstOk ? { frame_index: firstOk.frame_index, pts: firstOk.pts as number } : null) : [],
      comparison: { state: "not_evaluated", delta: null, reason: "No validated measurement or comparable history." },
      message: "Demo: simulated data; no pose inference or biomechanical validation.",
      error: run.state === "failed" ? run.error : null,
    };
  };

  const deletionOf = (r: Record_): DeletionState => {
    if (r.deletionAt === null) return "none";
    const t = now() - r.deletionAt;
    if (t < DELETE_MS.access_blocked * speed) return "access_blocked";
    if (t < (DELETE_MS.access_blocked + DELETE_MS.removing_files) * speed) return "removing_files";
    return "deleted";
  };

  const toSession = (r: Record_): Session => {
    const s = SCENARIOS[r.scenario];
    const upload = uploadOf(r);
    const uploaded = upload.state === "done";
    const rejected = uploaded && !!s.rejection;
    const run = runOf(r);
    const frames = clipOf(r.scenario).frames;
    return {
      session_id: r.id,
      created_at: new Date(r.createdAt).toISOString(),
      is_demo: true,
      video: { title: s.title, source_name: s.source_name, duration_seconds: frames[frames.length - 1]!.playback_time_s },
      asset_id: assetIdOf(r.scenario),
      asset_state: !uploaded ? "importing" : rejected ? "rejected" : "ready",
      upload,
      rejection: rejected ? { schema_version: "0.1.0", ...s.rejection! } : null,
      run,
      run_count: r.runs.length,
      capture: s.block ? captureOf(r) : run?.state === "succeeded" ? captureOf(r) : null,
      report: run ? reportOf(r, run) : null,
      deletion: deletionOf(r),
    };
  };

  const replayOf = (r: Record_): Replay => {
    const clip = clipOf(r.scenario);
    const s = SCENARIOS[r.scenario];
    const sel = selectionOf(r);
    const frames: ReplayFrame[] = clip.frames.map((f, i) => {
      const entry = sel[i];
      const det = entry?.status === "selected" ? f.detections.find((d) => d.detection_id === entry.detection_id) : undefined;
      // Política simulada do backend: o que não pode ser desenhado sai como null.
      const keypoints = det ? det.keypoints.map((k) => {
        const outside = k.x === null || k.y === null || k.x < 0 || k.y < 0 || k.x > f.display_width || k.y > f.display_height;
        return outside || k.visibility < 0.5 ? { name: k.name, x: null, y: null } : { name: k.name, x: k.x, y: k.y };
      }) : null;
      return {
        frame_index: f.frame_index,
        pts: f.pts,
        playback_time_s: f.playback_time_s,
        status: entry?.status ?? "not_started",
        reason: entry ? entry.reason : "no_selection",
        keypoints,
      };
    });
    const run = runOf(r);
    return {
      session_id: r.id,
      run_id: run?.run_id ?? null,
      is_demo: true,
      asset_id: assetIdOf(r.scenario),
      time_base: "1/90000",
      display_width: s.spec.width,
      display_height: s.spec.height,
      frames,
      capture: captureOf(r),
      coverage: { frames_with_skeleton: frames.filter((f) => f.keypoints !== null).length, total_frames: frames.length },
      evaluation: { status: "not_evaluated", reasons: ["annotations_unreviewed"] },
      provenance: { adapter: "simulado", adapter_version: "sem inferência", simulated: true },
    };
  };

  const newRun = (r: Record_, seeds: Seed[], failing: boolean): RunRecord => ({
    run_id: `demo-run-${r.id}-${r.runs.length + 1}`, seeds, startedAt: now(), cancelledAt: null, failing,
  });

  return {
    isDemo: true,

    listLocalVideos(): LocalVideo[] {
      return SCENARIO_ORDER.map((id) => {
        const s = SCENARIOS[id];
        const frames = clipOf(id).frames;
        return {
          id, title: s.title, situation: s.situation, recommended: s.recommended,
          duration_seconds: frames[frames.length - 1]!.playback_time_s,
        };
      });
    },
    openLocalPainter: (videoId) => clipOf(videoId as ScenarioId).painter,

    async listSessions() {
      return load().sessions.slice().reverse().map(toSession).filter((s) => s.deletion !== "deleted");
    },
    async getSession(id) {
      const r = load().sessions.find((x) => x.id === id);
      return r ? toSession(r) : null;
    },

    async createSession(videoId) {
      const s = load();
      s.counter += 1;
      const t = now();
      const rec: Record_ = {
        id: `demo-session-${s.counter}`, scenario: videoId as ScenarioId, createdAt: t,
        uploadStartedAt: t, resumedAt: null, runs: [], deletionAt: null, flags: [],
      };
      s.sessions.push(rec);
      save(s);
      return toSession(rec);
    },
    async resumeUpload(id) { update(id, (r) => { r.resumedAt = now(); }); },

    async getSeedOptions(id): Promise<SeedOptions> {
      const r = find(id);
      const scenario = SCENARIOS[r.scenario];
      if (scenario.block) return { blocked: captureOf(r).issues[0]!, frames: [] };
      const frames = clipOf(r.scenario).frames;
      // Em uma nova seleção, só oferece quadros depois do último trecho acompanhado.
      const after = r.runs.length ? captureOf(r).issues.find((i) => i.code === "player_lost" || i.code === "player_ambiguous")?.frame_index ?? -1 : -1;
      return {
        blocked: null,
        frames: scenario.seedTimes
          .map((t) => frameNear(frames, t))
          .filter((f) => f.frame_index > after && f.detections.length > 0)
          .map((f) => ({
            frame_index: f.frame_index, pts: f.pts as number,
            detections: f.detections.map((d) => ({ detection_id: d.detection_id, bbox: d.bbox })),
          })),
      };
    },
    async startAnalysis(id, seed) {
      update(id, (r) => { r.runs.push(newRun(r, [seed], !!SCENARIOS[r.scenario].failFirstRun && r.runs.length === 0)); });
    },
    async reselect(id, seed) {
      update(id, (r) => {
        const prior = r.runs[r.runs.length - 1]?.seeds ?? [];
        r.runs.push(newRun(r, [...prior, seed], false));
      });
    },
    async retry(id) {
      update(id, (r) => {
        const prior = r.runs[r.runs.length - 1]?.seeds ?? [];
        r.runs.push(newRun(r, prior, false));
      });
    },
    async cancelRun(id) {
      update(id, (r) => {
        const rec = r.runs[r.runs.length - 1];
        if (rec) rec.cancelledAt = now();
      });
    },

    async getReplay(id) { return replayOf(find(id)); },
    openPainter: (id): FramePainter => clipOf(find(id).scenario).painter,

    async flagFrame(id, frame) { update(id, (r) => { r.flags.push(frame); }); },
    async deleteSession(id) { update(id, (r) => { r.deletionAt = now(); }); },

    resetAll() { storage.removeItem(KEY); },
    async seedLab(scenario, target) {
      const session = await this.createSession(scenario);
      const seedTime = SCENARIOS[scenario].seedTimes[0] ?? 0;
      const frame = frameNear(clipOf(scenario).frames, seedTime);
      const seed = { frame_index: frame.frame_index, detection_id: frame.detections.find((d) => d.keypoints)?.detection_id ?? "0" };
      // Escolhe a pessoa em primeiro plano, a mesma que o tester escolheria.
      const big = frame.detections.slice().sort((a, b) => (b.bbox.y2 - b.bbox.y1) - (a.bbox.y2 - a.bbox.y1))[0];
      if (big) seed.detection_id = big.detection_id;
      update(session.session_id, (r) => {
        r.uploadStartedAt = 0;
        r.resumedAt = SCENARIOS[scenario].interruptAt !== undefined ? 0 : null;
        if (target === "processing" && frame.detections.length) r.runs.push(newRun(r, [seed], false));
        if (target === "done" && frame.detections.length) { const run = newRun(r, [seed], false); run.startedAt = 0; r.runs.push(run); }
      });
      return session.session_id;
    },
  };
}
