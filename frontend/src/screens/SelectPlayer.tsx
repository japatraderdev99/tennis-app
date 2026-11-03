import { useEffect, useState } from "react";
import type { Seed, SeedOptions, Session } from "../api/types";
import { ISSUE_COPY } from "../domain/copy";
import { go } from "../domain/route";
import { Screen, useClient } from "../ui/parts";
import { VideoStage } from "../ui/VideoStage";

/** A seleção é sempre explícita, inclusive com uma pessoa só. Nada vem pré-marcado. */
export function SelectPlayer({ session, again, refresh }: { session: Session; again?: boolean; refresh: () => void }) {
  const client = useClient();
  const id = session.session_id;
  const [options, setOptions] = useState<SeedOptions>();
  const [frameAt, setFrameAt] = useState(0);
  const [choice, setChoice] = useState<Seed | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    setOptions(undefined); setChoice(null); setFrameAt(0); setError(false);
    void client.getSeedOptions(id).then((data) => { if (active) setOptions(data); }, () => { if (active) setError(true); });
    return () => { active = false; };
  }, [client, id, retry]);

  if (error && !options) return <Screen title="Não consegui carregar as pessoas" back={{ label: "Seus saques", onClick: () => go("/") }}><p role="alert">Tente abrir os quadros novamente.</p><button className="btn btn-principal" onClick={() => setRetry((n) => n + 1)}>Carregar quadros de novo</button></Screen>;

  if (!options) return <Screen title="Procurando pessoas no vídeo"><p role="status">Isto leva poucos instantes.</p></Screen>;

  if (options.blocked) {
    const copy = ISSUE_COPY[options.blocked.code];
    return (
      <Screen title={copy.title} back={{ label: "Seus saques", onClick: () => go("/") }}>
        <p className="lead">{copy.why}</p>
        <p style={{ marginBottom: 16 }}><b>{copy.action}</b></p>
        <div className="acoes">
          <button type="button" className="btn btn-principal" onClick={() => go("/como-filmar")}>Ver como filmar</button>
          <button type="button" className="btn btn-secundario" onClick={() => go(`/sessao/${id}/rever`)}>Rever o vídeo sem esqueleto</button>
        </div>
      </Screen>
    );
  }

  const seedFrame = options.frames[frameAt];
  const painter = client.openPainter(id);
  if (!seedFrame) {
    return (
      <Screen title="Não há outro momento para escolher" back={{ label: "Voltar à revisão", onClick: () => go(`/sessao/${id}`) }}>
        <p className="lead">Depois deste ponto, não encontrei pessoas no vídeo.</p>
      </Screen>
    );
  }
  const people = seedFrame.detections;

  return (
    <Screen
      title={again ? "Toque em você de novo" : "Toque em você"}
      compact
      hero={(
        <>
        {client.isDemo && <p className="demo-cue"><b>Escolha uma das pessoas desenhadas.</b> Toque na caixa sobre ela. Depois, confirme em “Sou eu: continuar”. Neste exemplo, ninguém é você de verdade.</p>}
        <div className="palco-sangria" style={{ marginBottom: 16 }}>
          <VideoStage painter={painter} frame={seedFrame.frame_index} label={`Quadro do vídeo com ${people.length === 1 ? "uma pessoa marcada" : `${people.length} pessoas marcadas`}.`}>
            {people.map((d, i) => {
              const pressed = choice?.frame_index === seedFrame.frame_index && choice.detection_id === d.detection_id;
              const left = (d.bbox.x1 / painter.width) * 100;
              const top = (Math.max(0, d.bbox.y1) / painter.height) * 100;
              const width = ((d.bbox.x2 - d.bbox.x1) / painter.width) * 100;
              const height = ((Math.min(painter.height, d.bbox.y2) - Math.max(0, d.bbox.y1)) / painter.height) * 100;
              return (
                <button
                  key={d.detection_id} type="button" className="caixa" aria-pressed={pressed}
                  aria-label={`Pessoa ${i + 1} de ${people.length}`}
                  style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                  onClick={() => setChoice({ frame_index: seedFrame.frame_index, detection_id: d.detection_id })}
                >
                  <span aria-hidden="true">{pressed ? "Você" : `Pessoa ${i + 1}`}</span>
                </button>
              );
            })}
          </VideoStage>
        </div>
        </>
      )}
    >
      <p style={{ marginBottom: 12 }}>
        {again
          ? "Depois daqui, o esqueleto volta a acompanhar quem você tocar."
          : "O esqueleto acompanha só quem você escolher."}
      </p>
      <div className="detalhes">
        <details className="detalhe">
          <summary>Por que preciso escolher?</summary>
          <div><p>Na quadra pode haver outras pessoas, e o app não reconhece rostos. Se ele perder você, vai pedir para escolher de novo em vez de adivinhar.</p></div>
        </details>
      </div>
      <div className="acoes">
        {error && <p role="alert">Não consegui iniciar. Sua escolha foi mantida; tente novamente.</p>}
        <button
          type="button" className="btn btn-principal" disabled={!choice || sending}
          onClick={async () => {
            if (!choice || sending) return;
            setSending(true); setError(false);
            try {
              if (again) await client.reselect(id, choice);
              else await client.startAnalysis(id, choice);
              refresh(); go(`/sessao/${id}`);
            } catch { setError(true); }
            finally { setSending(false); }
          }}
        >
          {choice ? "Sou eu: continuar" : "Toque em você para continuar"}
        </button>
        {options.frames.length > 1 && (
          <button type="button" className="btn-texto" onClick={() => { setFrameAt((frameAt + 1) % options.frames.length); setChoice(null); }}>
            Não estou aqui: ver outro momento
          </button>
        )}
      </div>
    </Screen>
  );
}
