import { useEffect, useRef, useState, type RefObject } from "react";
import type { FramePose, PoseCapabilities } from "./poseTypes";
import { validateFramePose } from "./framePoseValidation";
import { formatPlayback } from "./moments";
import "./frame-analysis.css";

const EDGES = [[5, 6], [5, 7], [7, 9], [6, 8], [8, 10], [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16]] as const;
interface Snapshot { url: string; time: number; width: number; height: number }
type Phase = "idle" | "capturing" | "processing" | "done" | "error";

async function waitForFrame(video: HTMLVideoElement, signal: AbortSignal) {
  await new Promise<void>((resolve, reject) => {
    const events = ["seeked", "loadeddata", "canplay", "loadedmetadata", "error"];
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer); window.clearInterval(poll);
      for (const event of events) video.removeEventListener(event, check);
      signal.removeEventListener("abort", aborted);
      if (error) reject(error); else resolve();
    };
    const aborted = () => finish(new Error("cancelled"));
    const check = () => {
      if (signal.aborted) aborted();
      else if (video.error) finish(new Error("frame_not_ready"));
      else if (!video.seeking && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) finish();
    };
    const timer = window.setTimeout(() => finish(new Error("frame_not_ready")), 4000);
    const poll = window.setInterval(check, 50);
    for (const event of events) video.addEventListener(event, check);
    signal.addEventListener("abort", aborted, { once: true });
    check();
  });
}

function errorCopy(code: string): string {
  if (code === "invalid_pose_response") return "O resultado não corresponde a esta imagem. Nenhum esqueleto foi exibido. Tente analisar novamente.";
  if (code === "frame_not_ready") return "O vídeo ainda está buscando esse momento. Aguarde a imagem aparecer e tente novamente.";
  if (code === "image_too_large") return "Este quadro ficou grande demais para o processamento local. Tente outro momento.";
  if (code === "busy" || code === "analysis_busy") return "Outra análise está em andamento neste computador. Aguarde e tente novamente.";
  return "Não foi possível analisar este quadro. Seu vídeo continua disponível. Tente novamente em alguns instantes.";
}

export function FrameAnalysis({ media, ready, videoId }: { media: RefObject<HTMLVideoElement | null>; ready: boolean; videoId: string }) {
  const [capabilities, setCapabilities] = useState<PoseCapabilities | null>(null);
  const [capLoading, setCapLoading] = useState(true);
  const [capRetry, setCapRetry] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [result, setResult] = useState<FramePose | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [overlay, setOverlay] = useState(true);
  const [message, setMessage] = useState("");
  const active = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const imageUrl = useRef<string | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const busy = phase === "capturing" || phase === "processing";

  useEffect(() => {
    const controller = new AbortController();
    setCapLoading(true);
    void fetch("/__local_pose/capabilities", { signal: controller.signal, cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("unavailable");
      const data = await response.json() as PoseCapabilities;
      if (typeof data.available !== "boolean" || !Number.isInteger(data.max_edge) || data.max_edge < 1 || data.max_edge > 1280
        || !Number.isInteger(data.max_bytes) || data.max_bytes < 1 || data.max_bytes > 4_194_304
        || typeof data.token !== "string" || data.token.length > 256 || (data.available && !data.token)) throw new Error("unavailable");
      if (!controller.signal.aborted) setCapabilities(data);
    }).catch(() => { if (!controller.signal.aborted) setCapabilities(null); })
      .finally(() => { if (!controller.signal.aborted) setCapLoading(false); });
    return () => controller.abort();
  }, [capRetry]);

  useEffect(() => {
    setPhase("idle"); setSnapshot(null); setResult(null); setSelected(null); setMessage("");
    return () => {
      generation.current++; active.current?.abort(); active.current = null;
      if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
      imageUrl.current = null;
    };
  }, [videoId]);
  useEffect(() => { if (phase === "done") resultHeading.current?.focus({ preventScroll: true }); }, [phase]);

  const clear = (cancelled = false) => {
    generation.current++; active.current?.abort(); active.current = null;
    if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
    imageUrl.current = null; setSnapshot(null); setResult(null); setSelected(null); setPhase("idle");
    setMessage(cancelled ? "Análise cancelada. Escolha um momento no vídeo para tentar novamente." : "Escolha outro momento no vídeo e clique em Analisar este quadro.");
  };

  const analyze = async () => {
    const video = media.current;
    if (!video || !ready || !capabilities?.available || active.current) return;
    const request = ++generation.current;
    const controller = new AbortController(); active.current = controller;
    setPhase("capturing"); setResult(null); setSelected(null); setOverlay(true); setMessage("");
    if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
    imageUrl.current = null; setSnapshot(null);
    const timeout = window.setTimeout(() => controller.abort(), 100_000);
    try {
      video.pause();
      await waitForFrame(video, controller.signal);
      if (request !== generation.current) return;
      if (controller.signal.aborted) throw new Error("cancelled");
      video.pause();
      if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) throw new Error("frame_not_ready");
      const scale = Math.min(1, capabilities.max_edge / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale)); canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("capture_unavailable");
      const playbackTime = video.currentTime;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("capture_unavailable")), "image/png"));
      if (blob.size > capabilities.max_bytes) throw new Error("image_too_large");
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())), byte => byte.toString(16).padStart(2, "0")).join("");
      if (request !== generation.current) return;
      if (controller.signal.aborted) throw new Error("cancelled");
      const url = URL.createObjectURL(blob); imageUrl.current = url;
      setSnapshot({ url, time: playbackTime, width: canvas.width, height: canvas.height }); setPhase("processing");
      const response = await fetch("/__local_pose/frame", {
        method: "POST", headers: { "Content-Type": "image/png", "X-Pose-Token": capabilities.token },
        body: blob, signal: controller.signal, cache: "no-store",
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { code?: string };
        throw new Error(error.code ?? "analysis_failed");
      }
      const data: unknown = await response.json();
      const verified = validateFramePose(data, { hash, width: canvas.width, height: canvas.height });
      if (request !== generation.current) return;
      if (controller.signal.aborted) throw new Error("cancelled");
      setResult(verified); setPhase("done");
    } catch (error) {
      if (request !== generation.current) return;
      setMessage(controller.signal.aborted ? "A análise demorou mais que o esperado. Tente novamente." : errorCopy(error instanceof Error ? error.message : "analysis_failed"));
      setPhase("error");
    } finally {
      window.clearTimeout(timeout);
      if (request === generation.current) active.current = null;
    }
  };

  const person = result?.people.find(p => p.id === selected);
  const visiblePoints = person?.keypoints.filter(p => p.x !== null && p.y !== null).length ?? 0;
  return <section className="r-analysis" aria-label="Análise de um quadro real">
    <div className="r-analysis-intro"><h2>Veja os pontos do corpo</h2><p>Escolha um momento no vídeo. A análise pausa a reprodução e examina só essa imagem.</p></div>
    <div className="r-analysis-actions">
      <button type="button" className="r-button r-primary" disabled={!ready || busy || capLoading || !capabilities?.available} onClick={() => void analyze()}>{busy ? "Analisando quadro…" : "Analisar este quadro"}</button>
      {busy && <button type="button" className="r-button r-secondary" onClick={() => clear(true)}>Cancelar análise do quadro</button>}
    </div>
    <p className="r-analysis-scope">Análise de um quadro real. Estimativa 2D, sem avaliação de técnica. A imagem é processada neste computador.</p>
    {capLoading ? <p role="status">Verificando análise local…</p> : !capabilities?.available && <div className="r-analysis-notice"><p>O motor de análise local está indisponível. Você pode continuar revendo o vídeo.</p><button type="button" className="r-button r-secondary" onClick={() => setCapRetry(n => n + 1)}>Verificar análise novamente</button></div>}
    {busy && <p className="r-analysis-notice" role="status">{phase === "capturing" ? "Preparando a imagem exibida no vídeo…" : "Localizando os pontos do corpo. A primeira análise pode levar alguns instantes."}</p>}
    {message && <p className="r-analysis-notice" role={phase === "error" ? "alert" : "status"}>{message}</p>}
    {snapshot && result && <div className="r-analysis-result">
      <h3 tabIndex={-1} ref={resultHeading}>{result.people.length ? selected ? "Confira os pontos estimados" : "Escolha o jogador nesta imagem" : "Não foi possível marcar uma pessoa neste quadro"}</h3>
      <p>{result.people.length ? selected ? "As linhas mostram apenas a estimativa deste quadro. Confira se os pontos acompanham o corpo." : "Toque em uma caixa ou escolha uma pessoa abaixo. Nada é selecionado automaticamente." : "Escolha outro momento em que o jogador apareça inteiro e mais próximo da câmera."}</p>
      <div className="r-analysis-image" style={{ aspectRatio: `${snapshot.width} / ${snapshot.height}` }}>
        <img src={snapshot.url} alt={`Imagem analisada, capturada no tempo ${formatPlayback(snapshot.time)} do player`} />
        {person && overlay && <svg data-testid="real-pose-overlay" viewBox={`0 0 ${result.width} ${result.height}`} aria-label="Pontos estimados do jogador escolhido" role="img">
          {EDGES.map(([a, b]) => {
            const from = person.keypoints[a], to = person.keypoints[b];
            return from && to && from.x !== null && from.y !== null && to.x !== null && to.y !== null
              ? <line key={`${a}-${b}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} /> : null;
          })}
          {person.keypoints.map(point => point.x !== null && point.y !== null ? <circle key={point.name} cx={point.x} cy={point.y} r={Math.max(3, result.width / 220)} /> : null)}
        </svg>}
        {result.people.map((candidate, index) => <button type="button" className="r-person-box" key={candidate.id} aria-label={`Selecionar pessoa ${index + 1} na imagem`} aria-pressed={selected === candidate.id}
          style={{ left: `${candidate.bbox.x1 / result.width * 100}%`, top: `${candidate.bbox.y1 / result.height * 100}%`, width: `${(candidate.bbox.x2 - candidate.bbox.x1) / result.width * 100}%`, height: `${(candidate.bbox.y2 - candidate.bbox.y1) / result.height * 100}%` }}
          onClick={() => { setSelected(candidate.id); setOverlay(true); }}><span>Pessoa {index + 1}</span></button>)}
      </div>
      <p className="r-analysis-caption">Imagem congelada de {formatPlayback(snapshot.time)} do player. Mover ou reproduzir o vídeo não muda esta análise.</p>
      {result.people.length > 0 && <div className="r-analysis-people" aria-label="Escolher jogador">
        {result.people.map((candidate, index) => <button type="button" className="r-button r-secondary" key={candidate.id} aria-pressed={selected === candidate.id} onClick={() => { setSelected(candidate.id); setOverlay(true); }}>Pessoa {index + 1}</button>)}
      </div>}
      {person && <div className="r-analysis-selection"><p role="status"><b>{visiblePoints} de 17 pontos disponíveis para desenhar.</b> Pontos ausentes não indicam erro no seu movimento.</p><button type="button" className="r-button r-secondary" aria-pressed={overlay} onClick={() => setOverlay(value => !value)}>{overlay ? "Ocultar esqueleto" : "Mostrar esqueleto"}</button></div>}
      <p className="r-analysis-limit">Este resultado não mede ângulos, força, qualidade do golpe ou evolução. Ainda não há acompanhamento do movimento ao longo do vídeo.</p>
      <button type="button" className="r-button r-secondary" onClick={() => clear()}>Escolher outro momento</button>
    </div>}
  </section>;
}
