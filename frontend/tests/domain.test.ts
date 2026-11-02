import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";
import type { CaptureIssueCode, Session } from "../src/api/types";
import { captureLine, ISSUE_COPY, processingLine } from "../src/domain/copy";
import { parseHash, viewForSession } from "../src/domain/route";
import { formatClock, frameAtTime, secondsFromPts, trackSegments } from "../src/domain/time";
import { createMockClient } from "../src/mocks/mockClient";
import { clipOf, SCENARIO_ORDER, SCENARIOS, type ScenarioId } from "../src/mocks/scenarios";
import { mergeSelections, selectTarget } from "../src/mocks/selection";
import { drawableBones } from "../src/ui/skeleton";

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}
const FAR = 10_000_000;

/** Pessoa em primeiro plano, a mesma que um tester tocaria. */
function foregroundSeed(id: ScenarioId, seconds: number) {
  const frames = clipOf(id).frames;
  const f = frames.reduce((a, b) => (Math.abs(b.playback_time_s - seconds) < Math.abs(a.playback_time_s - seconds) ? b : a));
  const d = f.detections.slice().sort((a, b) => (b.bbox.y2 - b.bbox.y1) - (a.bbox.y2 - a.bbox.y1))[0]!;
  return { frame_index: f.frame_index, detection_id: d.detection_id };
}

async function finished(id: ScenarioId) {
  const c = clock();
  const client = createMockClient({ now: c.now });
  const s = await client.createSession(id);
  c.advance(FAR);
  await client.startAnalysis(s.session_id, foregroundSeed(id, SCENARIOS[id].seedTimes[0]!));
  c.advance(FAR);
  return { client, c, id: s.session_id };
}

describe("tempo", () => {
  it("usa PTS e time_base, a partir do primeiro quadro", () => {
    expect(secondsFromPts(91001, 1001, "1/90000")).toBeCloseTo(1);
  });
  it("não transforma ausência em zero", () => {
    expect(secondsFromPts(null, 1001, "1/90000")).toBeNull();
    expect(formatClock(null)).toBe("sem tempo confiável");
  });
  it("formata com vírgula decimal", () => { expect(formatClock(63.25)).toBe("1:03,2"); });
  it("acha o quadro em intervalos irregulares", () => {
    const frames = [0, 0.03, 0.07, 0.1].map((playback_time_s) => ({ playback_time_s }));
    expect(frameAtTime(frames, 0.05)).toBe(1);
    expect(frameAtTime(frames, 0.07)).toBe(2);
    expect(frameAtTime(frames, 99)).toBe(3);
  });
});

describe("clipes simulados", () => {
  it.each(SCENARIO_ORDER)("%s é determinístico", (id) => {
    const spec = SCENARIOS[id].spec;
    const a = clipOf(id).frames;
    expect(a.length).toBeGreaterThan(30);
    expect(a[0]!.display_width).toBe(spec.width);
  });
  it("PTS começa fora de zero, cresce sempre e tem intervalos irregulares", () => {
    const f = clipOf("limpo").frames;
    expect(f[0]!.pts).toBe(1001);
    const deltas = f.slice(1).map((x, i) => (x.pts as number) - (f[i]!.pts as number));
    expect(Math.min(...deltas)).toBeGreaterThan(0);
    expect(new Set(deltas).size).toBeGreaterThan(5);
  });
});

describe("seleção", () => {
  it("nunca pula o jogador sem semente e continua no cenário limpo", () => {
    const sel = selectTarget(clipOf("limpo").frames, foregroundSeed("limpo", 0.4));
    expect(sel.filter((f) => f.status === "not_started").length).toBeGreaterThan(0);
    expect(sel.filter((f) => f.status === "lost" || f.status === "ambiguous")).toEqual([]);
  });
  it("perde quando o jogador sai e não recupera sozinho", () => {
    const sel = selectTarget(clipOf("perda").frames, foregroundSeed("perda", 0.3));
    const lost = sel.findIndex((f) => f.status === "lost");
    expect(lost).toBeGreaterThan(0);
    expect(sel[lost]!.reason).toBe("no_detections");
    expect(sel.slice(lost + 1).every((f) => f.status === "lost" && f.reason === "reseed_required")).toBe(true);
  });
  it("para em ambiguidade quando alguém cruza", () => {
    const sel = selectTarget(clipOf("cruzamento").frames, foregroundSeed("cruzamento", 0.3));
    expect(sel.some((f) => f.status === "ambiguous" && f.reason === "ambiguous_iou")).toBe(true);
  });
  it("só retoma com nova semente explícita, e o trecho perdido continua visível", () => {
    const frames = clipOf("perda").frames;
    const merged = mergeSelections([
      selectTarget(frames, foregroundSeed("perda", 0.3)),
      selectTarget(frames, foregroundSeed("perda", 8)),
    ]);
    expect(merged.some((f) => f.status === "lost")).toBe(true);
    expect(merged[merged.length - 1]!.status).toBe("selected");
  });
});

describe("relatório público", () => {
  const schema = JSON.parse(readFileSync(resolve(__dirname, "../../schemas/PublicReport.schema.json"), "utf8"));
  const validate = new Ajv2020({ strict: false, validateFormats: false }).compile(schema);

  it.each(["limpo", "pes", "perda", "cruzamento"] as ScenarioId[])("%s obedece ao schema real e value é null", async (id) => {
    const { client, id: sid } = await finished(id);
    const s = (await client.getSession(sid))!;
    expect(validate(s.report), JSON.stringify(validate.errors)).toBe(true);
    expect(s.report!.is_demo).toBe(true);
    for (const m of s.report!.metrics) expect(m.value).toBeNull();
    expect(s.report!.comparison.delta).toBeNull();
  });

  it("falha traz erro válido, sem métricas, e tentar de novo cria outro run_id", async () => {
    const c = clock();
    const client = createMockClient({ now: c.now });
    const s = await client.createSession("falha");
    c.advance(FAR);
    await client.startAnalysis(s.session_id, foregroundSeed("falha", 0.4));
    c.advance(FAR);
    const failed = (await client.getSession(s.session_id))!;
    expect(failed.run!.state).toBe("failed");
    expect(validate(failed.report), JSON.stringify(validate.errors)).toBe(true);
    expect(failed.report!.metrics).toEqual([]);
    await client.retry(s.session_id);
    c.advance(FAR);
    const ok = (await client.getSession(s.session_id))!;
    expect(ok.run!.state).toBe("succeeded");
    expect(ok.run!.run_id).not.toBe(failed.run!.run_id);
  });

  it("cancelamento produz relatório válido e sem erro", async () => {
    const c = clock();
    const client = createMockClient({ now: c.now });
    const s = await client.createSession("limpo");
    c.advance(FAR);
    await client.startAnalysis(s.session_id, foregroundSeed("limpo", 0.4));
    await client.cancelRun(s.session_id);
    const r = (await client.getSession(s.session_id))!;
    expect(r.run!.state).toBe("cancelled");
    expect(validate(r.report), JSON.stringify(validate.errors)).toBe(true);
    expect(r.report!.error).toBeNull();
  });
});

describe("replay", () => {
  it("não expõe score, visibility nem presence", async () => {
    const { client, id } = await finished("limpo");
    const text = JSON.stringify(await client.getReplay(id));
    expect(text).not.toMatch(/"score"|"visibility"|"presence"/);
  });
  it("pés fora da imagem saem como null, nunca zero nem preso à borda", async () => {
    const { client, id } = await finished("pes");
    const replay = await client.getReplay(id);
    const f = replay.frames.find((x) => x.keypoints)!;
    const ankle = f.keypoints!.find((k) => k.name === "left_ankle")!;
    expect(ankle.x).toBeNull();
    expect(ankle.y).toBeNull();
    const bones = drawableBones(f.keypoints!);
    expect(bones.flat().every((p) => p.x !== 0 && p.y !== 0)).toBe(true);
    expect(replay.capture.issues[0]!.code).toBe("feet_out_of_frame");
  });
  it("omite o punho incerto sem inventar posição", async () => {
    const { client, id } = await finished("limpo");
    const replay = await client.getReplay(id);
    const gap = replay.frames.filter((f) => f.keypoints?.find((k) => k.name === "right_wrist")?.x === null);
    expect(gap.length).toBeGreaterThan(0);
  });
  it("trilho marca o trecho sem esqueleto", async () => {
    const { client, id } = await finished("perda");
    const seg = trackSegments((await client.getReplay(id)).frames);
    expect(seg.some((s) => s.tracked)).toBe(true);
    expect(seg[seg.length - 1]!.tracked).toBe(false);
    expect(seg[seg.length - 1]!.to).toBe(1);
  });
  it("captura e processamento são independentes", async () => {
    const { client, id } = await finished("pes");
    const s = (await client.getSession(id))!;
    expect(s.run!.state).toBe("succeeded");
    expect(s.capture!.state).toBe("limited");
    expect(processingLine(s)).toBe("Processamento concluído");
    expect(captureLine(s)).toBe(ISSUE_COPY.feet_out_of_frame.title);
  });
  it("sem PTS confiável, o replay mantém null e bloqueia a seleção", async () => {
    const c = clock();
    const client = createMockClient({ now: c.now });
    const s = await client.createSession("camera-lenta");
    c.advance(FAR);
    expect((await client.getSeedOptions(s.session_id)).blocked!.code).toBe("timing_unreliable");
    const replay = await client.getReplay(s.session_id);
    expect(replay.frames.every((f) => f.pts === null && f.keypoints === null)).toBe(true);
    expect(replay.coverage.frames_with_skeleton).toBe(0);
  });
});

describe("fluxo", () => {
  it("rota segue o estado do servidor", async () => {
    const c = clock();
    const client = createMockClient({ now: c.now });
    const s = await client.createSession("limpo");
    const view = async () => viewForSession((await client.getSession(s.session_id)) as Session);
    expect(await view()).toBe("upload");
    c.advance(FAR);
    expect(await view()).toBe("select");
    await client.startAnalysis(s.session_id, foregroundSeed("limpo", 0.4));
    expect(await view()).toBe("processing");
    c.advance(FAR);
    expect(await view()).toBe("replay");
    await client.deleteSession(s.session_id);
    expect(await view()).toBe("deletion");
    c.advance(FAR);
    expect((await client.listSessions()).length).toBe(0);
  });
  it("envio interrompido para e retoma de onde parou", async () => {
    const c = clock();
    const client = createMockClient({ now: c.now });
    const s = await client.createSession("conexao");
    c.advance(FAR);
    const stopped = (await client.getSession(s.session_id))!;
    expect(stopped.upload.state).toBe("interrupted");
    await client.resumeUpload(s.session_id);
    const resumed = (await client.getSession(s.session_id))!;
    expect(resumed.upload.bytes_sent).toBe(stopped.upload.bytes_sent);
    c.advance(FAR);
    expect((await client.getSession(s.session_id))!.asset_state).toBe("ready");
  });
  it("arquivo recusado usa o envelope de erro", async () => {
    const c = clock();
    const client = createMockClient({ now: c.now });
    const s = await client.createSession("arquivo");
    c.advance(FAR);
    const r = (await client.getSession(s.session_id))!;
    expect(viewForSession(r)).toBe("rejected");
    expect(r.rejection!.code).toBe("duration_limit");
  });
  it("rotas por hash", () => {
    expect(parseHash("#/sessao/x/escolher-de-novo")).toEqual({ name: "reselect", id: "x" });
    expect(parseHash("")).toEqual({ name: "home" });
  });
});

describe("linguagem", () => {
  const all = Object.values(ISSUE_COPY).flatMap((c) => [c.title, c.why, c.action]).join(" ");
  it("todo problema tem título, motivo e ação", () => {
    for (const code of Object.keys(ISSUE_COPY) as CaptureIssueCode[]) {
      expect(ISSUE_COPY[code].title && ISSUE_COPY[code].why && ISSUE_COPY[code].action).toBeTruthy();
    }
  });
  it("não julga técnica nem expõe número de qualidade", () => {
    expect(all).not.toMatch(/\b(nota|score|ruim|errad[oa]|ideal|melhorou|precis[ãa]o|confian[çc]a)\b/i);
    expect(all).not.toMatch(/\d+\s*(%|°|\/10)/);
  });
});
