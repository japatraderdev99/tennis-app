/**
 * Exporta exemplos simulados a partir dos mesmos geradores dos mocks.
 *   tsx scripts/export-fixtures.ts fixtures          exemplos para o handoff
 *   tsx scripts/export-fixtures.ts <tmp> --full      + PoseArtifact para verificar contra o backend
 * Nada aqui contém atleta, vídeo real ou inferência de modelo.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createMockClient } from "../src/mocks/mockClient";
import { assetIdOf, clipOf, SCENARIO_ORDER, SCENARIOS, type ScenarioId } from "../src/mocks/scenarios";
import { selectTarget } from "../src/mocks/selection";

const out = process.argv[2];
const full = process.argv.includes("--full");
if (!out) throw new Error("Informe o diretório de saída");
mkdirSync(out, { recursive: true });
const write = (name: string, data: unknown) => writeFileSync(join(out, name), `${JSON.stringify(data, null, 2)}\n`);

let t = 1_762_000_000_000; // relógio fixo: a saída é reprodutível
const FAR = 100_000_000;
const NOTICE = "Simulado para revisão de interface. Não contém atleta nem inferência de modelo.";

function seedFor(id: ScenarioId, seconds: number) {
  const frames = clipOf(id).frames;
  const f = frames.reduce((a, b) => (Math.abs(b.playback_time_s - seconds) < Math.abs(a.playback_time_s - seconds) ? b : a));
  const d = f.detections.slice().sort((a, b) => (b.bbox.y2 - b.bbox.y1) - (a.bbox.y2 - a.bbox.y1))[0]!;
  return { frame_index: f.frame_index, detection_id: d.detection_id };
}

/** Só alguns quadros, para o exemplo ser legível. */
const trimReplay = <T extends { frames: unknown[] }>(r: T) => ({
  ...r, frames: r.frames.filter((_, i) => i % 40 === 0), frames_note: "Amostra: 1 a cada 40 quadros.",
});

const summary: unknown[] = [];
for (const id of SCENARIO_ORDER) {
  const client = createMockClient({ now: () => t });
  const s = await client.createSession(id);
  const sid = s.session_id;
  const uploading = await client.getSession(sid);
  t += FAR;
  if (SCENARIOS[id].interruptAt !== undefined) { write(`${id}.upload-interrompido.session.json`, { notice: NOTICE, ...(await client.getSession(sid)) }); await client.resumeUpload(sid); t += FAR; }
  const options = await client.getSeedOptions(sid);
  const record: Record<string, unknown> = { notice: NOTICE, scenario: id, situation: SCENARIOS[id].situation, seed_options: options };
  if (SCENARIOS[id].seedTimes.length) {
    const seed = seedFor(id, SCENARIOS[id].seedTimes[0]!);
    await client.startAnalysis(sid, seed);
    record.seed = seed;
    record.session_processing = await client.getSession(sid);
    t += FAR;
  }
  record.session_uploading = uploading;
  record.session = await client.getSession(sid);
  if (!SCENARIOS[id].rejection) record.replay_sample = trimReplay(await client.getReplay(sid));
  write(`${id}.json`, record);

  if (full) {
    const frames = clipOf(id).frames;
    const seedable = SCENARIOS[id].seedTimes.length > 0;
    if (seedable) {
      const seed = seedFor(id, SCENARIOS[id].seedTimes[0]!);
      write(`${id}.artifact.json`, {
        artifact: {
          pose_schema_version: "0.1.0", asset_id: assetIdOf(id), time_base: "1/90000",
          coordinate_space: "display_pixels", keypoint_schema: "coco17",
          frames: frames.map((f) => ({
            frame_index: f.frame_index, pts: f.pts, display_width: f.display_width,
            display_height: f.display_height, detections: f.detections,
          })),
          // Exigência do validador. Só existe no diretório temporário da verificação.
          provenance: {
            kind: "model_inference", adapter: "mediapipe", adapter_version: "simulated-no-inference",
            model_files: [{ role: "simulated", sha256: "0".repeat(64) }], runtime: { note: "simulated" }, parameters: {}, transforms: ["simulated"],
          },
          validation_ref: null, measurement_status: "research_only",
        },
        seed,
        expected: selectTarget(frames, seed),
      });
      const rep = (await client.getSession(sid))!.report;
      write(`${id}.report.json`, rep);
    }
  }
  summary.push({ scenario: id, file: `${id}.json` });
}
write("index.json", { notice: NOTICE, scenarios: summary });
