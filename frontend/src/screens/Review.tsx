import { useEffect, useMemo, useRef, useState } from "react";
import type { CaptureIssue, Replay, Session } from "../api/types";
import { captureLine, ISSUE_COPY, METRIC_COPY, processingLine } from "../domain/copy";
import { go } from "../domain/route";
import { formatClock, frameAtTime, secondsFromPts, trackSegments } from "../domain/time";
import { Screen, useClient } from "../ui/parts";
import { VideoStage } from "../ui/VideoStage";
import { DeleteButton } from "./Status";

const RATES = [1, 0.5, 0.25];
const rateLabel = (r: number) => (r === 1 ? "Velocidade normal" : r === 0.5 ? "Metade da velocidade" : "Um quarto da velocidade");

export function Review({ session, refresh }: { session: Session; refresh: () => void }) {
  const client = useClient();
  const id = session.session_id;
  const [replay, setReplay] = useState<Replay>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const runId = session.run?.run_id ?? null;
  useEffect(() => {
    let active = true;
    setReplay(undefined); setError(false);
    void client.getReplay(id).then((data) => { if (active) setReplay(data); }, () => { if (active) setError(true); });
    return () => { active = false; };
  }, [client, id, runId, retry]);
  if (error) return <Screen title="Não consegui abrir a revisão" back={{ label: "Seus saques", onClick: () => go("/") }}><p role="alert">Tente carregar novamente. O vídeo não foi excluído por esta falha.</p><button className="btn btn-principal" onClick={() => setRetry((n) => n + 1)}>Carregar revisão de novo</button></Screen>;
  if (!replay) return <Screen title="Abrindo a revisão"><p role="status">Carregando o vídeo.</p></Screen>;
  if (!replay.frames.length) return <Screen title="Ainda não há quadros para rever" back={{ label: "Seus saques", onClick: () => go("/") }}><p>Esta revisão não trouxe imagens disponíveis. Tente abrir a sessão novamente.</p></Screen>;
  return <ReviewBody key={runId ?? "sem-analise"} session={session} replay={replay} refresh={refresh} />;
}

function ReviewBody({ session, replay, refresh }: { session: Session; replay: Replay; refresh: () => void }) {
  const client = useClient();
  const id = session.session_id;
  const painter = client.openPainter(id);
  const frames = replay.frames;
  const lastIndex = frames.length - 1;
  const firstPts = frames[0]?.pts ?? null;

  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [overlay, setOverlay] = useState(true);
  const [flagged, setFlagged] = useState<number | null>(null);
  const clock = useRef(0);

  const frame = frames[frameIdx]!;
  const segments = useMemo(() => trackSegments(frames), [frames]);
  const duration = frames[lastIndex]!.playback_time_s || 1;

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let previous = performance.now();
    const loop = (t: number) => {
      clock.current += ((t - previous) / 1000) * rate;
      previous = t;
      if (clock.current >= duration) {
        clock.current = duration;
        setFrameIdx(lastIndex);
        setPlaying(false);
        return;
      }
      setFrameIdx(frameAtTime(frames, clock.current));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, rate, frames, duration, lastIndex]);

  const seek = (index: number) => {
    const next = Math.min(lastIndex, Math.max(0, index));
    setPlaying(false);
    setFrameIdx(next);
    clock.current = frames[next]!.playback_time_s;
  };
  const toggle = () => {
    if (!playing && frameIdx >= lastIndex) { clock.current = 0; setFrameIdx(0); }
    setPlaying(!playing);
  };

  const hasSkeleton = replay.coverage.frames_with_skeleton > 0;
  const skeletonHere = frame.keypoints !== null;
  const time = formatClock(secondsFromPts(frame.pts, firstPts, replay.time_base));
  const total = formatClock(secondsFromPts(frames[lastIndex]!.pts, firstPts, replay.time_base));
  const reliable = firstPts !== null;

  const label = !overlay || !hasSkeleton
    ? `Vídeo simulado, ${time}. Sem esqueleto visível.`
    : skeletonHere
      ? `Vídeo simulado, ${time}. Esqueleto estimado sobre o jogador.`
      : `Vídeo simulado, ${time}. Não há esqueleto neste quadro.`;

  const primary = replay.capture.issues[0];
  const others = replay.capture.issues.slice(1);

  return (
    <Screen
      title={session.video.title}
      compact
      back={{ label: "Seus saques", onClick: () => go("/") }}
    >
      {client.isDemo && <p className="demo-cue"><b>Agora, toque em Reproduzir.</b> Pause para usar “Próximo quadro”{hasSkeleton ? " ou toque em “Esqueleto ligado” para esconder as linhas." : "."} Este exemplo não avalia sua técnica.</p>}
      <div className="revisao-layout">
      <section className="revisao-video" aria-label="Vídeo e reprodução">
        <div className="palco-sangria" style={{ marginTop: 0 }}>
          <VideoStage painter={painter} frame={frameIdx} keypoints={overlay ? frame.keypoints : null} label={label} />
        </div>
      <div className="controles">
        <div className="tempo-linha">
          <span className="tempo" data-testid="tempo">{reliable ? time : "Tempo indisponível"}</span>
          {reliable && <span className="menor">de {total}</span>}
        </div>
        <div className="trilho">
          {segments.map((s) => (
            <i key={s.from} className="trilho-seg" data-com={s.tracked ? "sim" : "nao"} style={{ left: `${s.from * 100}%`, width: `${(s.to - s.from) * 100}%` }} />
          ))}
          <input
            type="range" min={0} max={lastIndex} step={1} value={frameIdx}
            aria-label="Posição no vídeo" aria-valuetext={time}
            onChange={(e) => seek(Number(e.target.value))}
          />
          <i className="trilho-marca" style={{ left: `${(frame.playback_time_s / duration) * 100}%` }} />
        </div>
        <p className="legenda-trilho">
          {hasSkeleton && <span><i className="l-com" />Com esqueleto</span>}
          {segments.some((s) => !s.tracked) && <span><i className="l-sem" />Sem esqueleto</span>}
        </p>
        <div className="botoes-video">
          <button type="button" onClick={() => seek(frameIdx - 1)}>Quadro anterior</button>
          <button type="button" className="tocar" onClick={toggle}>{playing ? "Pausar" : "Reproduzir"}</button>
          <button type="button" onClick={() => seek(frameIdx + 1)}>Próximo quadro</button>
        </div>
        <div className="botoes-extra">
          <button type="button" onClick={() => setRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length]!)}>{rateLabel(rate)}</button>
          {hasSkeleton && (
            <button type="button" aria-pressed={overlay} onClick={() => setOverlay(!overlay)}>{overlay ? "Esqueleto ligado" : "Esqueleto desligado"}</button>
          )}
        </div>
      </div>

      </section>
      <section className="revisao-leitura" aria-label="Leitura da revisão">
      <h2 className="subtitulo">Observe um momento por vez</h2>
      <p className="orientacao-replay">{hasSkeleton
        ? "Pause, avance um quadro e confira se o desenho acompanha o corpo. Você pode desligar o esqueleto para olhar só o vídeo."
        : "Pause e avance um quadro para observar o movimento. Este vídeo está disponível sem esqueleto."}</p>

      {primary && <IssueCard issue={primary} id={id} jump={primary.frame_index !== null ? () => seek(primary.frame_index!) : undefined} />}

      <dl className="estados">
        <div><dt>Processamento</dt><dd>{session.run ? processingLine(session) : "Não analisado"}</dd></div>
        <div><dt>Acompanhamento neste trecho</dt><dd>{captureLine({ ...session, capture: replay.capture })}</dd></div>
      </dl>

      {hasSkeleton && overlay && !skeletonHere && !primary && (
        <p role="status" style={{ marginBottom: 12 }}>Não há esqueleto neste quadro.</p>
      )}

      <div className="detalhes">
        {hasSkeleton && <details className="detalhe">
          <summary>Como ler o esqueleto</summary>
          <div>
            <p>{client.isDemo ? "Neste exemplo, os pontos e linhas são simulados. A demonstração mostra como usar os controles; não houve análise de uma gravação real." : "É uma estimativa de onde está o corpo em cada quadro. Confira se os pontos batem com o que você vê."}</p>
            <p>Quando falta um pedaço do esqueleto, o app não conseguiu marcar aquele ponto. Isso não indica erro no seu movimento.</p>
            <button type="button" className="voltar" onClick={() => go("/limites")}>Ler os limites do app</button>
          </div>
        </details>}
        {others.length > 0 && (
          <details className="detalhe">
            <summary>Outros pontos da filmagem</summary>
            <div>{others.map((o) => <p key={`${o.code}-${o.frame_index}`}><b>{ISSUE_COPY[o.code].title}.</b> {ISSUE_COPY[o.code].action}</p>)}</div>
          </details>
        )}
        <details className="detalhe">
          <summary>Medidas do movimento</summary>
          <div>
            {session.report && session.report.metrics.length > 0
              ? session.report.metrics.map((m) => <p key={m.metric_id}><b>Flexão aparente do joelho da frente.</b> {METRIC_COPY[m.status]}</p>)
              : <p>Esta versão não mostra medidas. Nenhuma foi validada ainda.</p>}
            <p>Comparação com outros vídeos: ainda não disponível.</p>
          </div>
        </details>
        {hasSkeleton && (
          <details className="detalhe">
            <summary>A marcação parece errada</summary>
            <div>
              {flagged === frameIdx
                ? <p role="status">Quadro anotado. O vídeo não muda; isso serve para revisarmos a marcação.</p>
                : <p>Pare no quadro em que a marcação parece errada e avise. O vídeo não muda.</p>}
              {flagged !== frameIdx && (
                <button type="button" className="btn btn-secundario" onClick={async () => { await client.flagFrame(id, frameIdx); setFlagged(frameIdx); }}>Avisar sobre este quadro</button>
              )}
            </div>
          </details>
        )}
        <details className="detalhe">
          <summary>Detalhes técnicos</summary>
          <div>
            <dl className="dados">
              <div><dt>Quadros com esqueleto</dt><dd data-testid="cobertura">{replay.coverage.frames_with_skeleton} de {replay.coverage.total_frames}</dd></div>
              <div><dt>Quadro atual</dt><dd>{frame.frame_index}</dd></div>
              <div><dt>Situação neste quadro</dt><dd>{frame.status}{frame.reason ? ` (${frame.reason})` : ""}</dd></div>
              <div><dt>Comparação com referência humana</dt><dd>Não avaliada</dd></div>
              <div><dt>Origem</dt><dd>{replay.provenance.adapter}, {replay.provenance.adapter_version}</dd></div>
            </dl>
          </div>
        </details>
      </div>
      <div className="acoes" style={{ position: "static" }}>
        {client.isDemo && <a className="demo-real-link" href="#/estados">Voltar ao guia da demonstração</a>}
        <button type="button" className="btn btn-secundario" onClick={() => go("/como-filmar")}>Novo vídeo</button>
        <DeleteButton session={session} refresh={refresh} />
      </div>
      </section>
      </div>
    </Screen>
  );
}

function IssueCard({ issue, id, jump }: { issue: CaptureIssue; id: string; jump?: () => void }) {
  const copy = ISSUE_COPY[issue.code];
  const canReselect = issue.code === "player_lost" || issue.code === "player_ambiguous";
  return (
    <section className="problema" aria-label="Problema de filmagem">
      <h2>{copy.title}</h2>
      <p>{copy.why}</p>
      <p className="acao-filmar">{copy.action}</p>
      {jump && <button type="button" className="btn-link" onClick={jump}>Ver no vídeo</button>}
      {canReselect && <button type="button" className="btn btn-principal" onClick={() => go(`/sessao/${id}/escolher-de-novo`)}>Escolher você de novo</button>}
      {issue.code === "feet_out_of_frame" && <button type="button" className="btn btn-principal" onClick={() => go("/como-filmar")}>Ver como filmar</button>}
    </section>
  );
}
