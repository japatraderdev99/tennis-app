import { useEffect, useState } from "react";
import { go } from "../domain/route";
import { formatBytes } from "../domain/time";
import { captureLine, processingLine, REJECTION_COPY, REJECTION_FALLBACK } from "../domain/copy";
import { formatDate, Screen, Thumb, useClient, usePolling } from "../ui/parts";
import { VideoStage } from "../ui/VideoStage";
import type { Session } from "../api/types";

const INTRO_KEY = "quadro.demo.intro";
export const introSeen = () => { try { return localStorage.getItem(INTRO_KEY) === "1"; } catch { return true; } };

export function Intro() {
  const client = useClient();
  const painter = client.openLocalPainter("limpo");
  const [frame, setFrame] = useState(68);
  const [playing, setPlaying] = useState(false);

  // Movimento só após uma ação explícita; pode ser pausado a qualquer momento.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const start = performance.now();
    const loop = (t: number) => {
      setFrame(Math.floor(((t - start) / 1000) * 30) % 170);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  return (
    <Screen
      title="Veja seu saque de fora"
      hero={<div className="heroi"><VideoStage painter={painter} frame={frame} label="Demonstração: jogador simulado fazendo um saque." /></div>}
    >
      <p className="abertura-marca">Quadro</p>
      <p className="lead">Filme um saque, marque quem é você e reveja o movimento quadro a quadro, com um esqueleto estimado sobre o vídeo.</p>
      <button type="button" className="btn-texto movimento-demo" onClick={() => setPlaying(!playing)}>{playing ? "Pausar demonstração" : "Ver o movimento simulado"}</button>
      <p>Confira o desenho com o que você vê no vídeo. Quando a marcação falhar, a revisão mostra onde parou. Medidas do movimento ainda estão em validação.</p>
      <div className="acoes">
        <button type="button" className="btn btn-principal" onClick={() => { try { localStorage.setItem(INTRO_KEY, "1"); } catch { /* segue */ } go("/como-filmar"); }}>Começar</button>
      </div>
    </Screen>
  );
}

export function Home() {
  const client = useClient();
  const sessions = usePolling(() => client.listSessions(), 1000, []);
  return (
    <Screen title="Seus saques">
      {sessions && sessions.length === 0 && (
        <div className="lead">
          <p>Nenhum vídeo guardado. Filme um saque e reveja aqui.</p>
        </div>
      )}
      {sessions && sessions.length > 0 && (
        <ul className="sessoes">{sessions.map((s) => <SessionRow key={s.session_id} session={s} />)}</ul>
      )}
      <div className="detalhes">
        <details className="detalhe">
          <summary>Onde vejo minha evolução?</summary>
          <div><p>Ainda não há gráfico de evolução. Ele depende de medidas validadas e de gravações feitas nas mesmas condições. Enquanto isso, você pode rever e comparar seus vídeos com os próprios olhos.</p></div>
        </details>
        <details className="detalhe">
          <summary>O que o esqueleto diz</summary>
          <div>
            <p>Mostra uma estimativa de onde está o corpo em cada quadro. Não dá nota e não prova que o movimento está certo ou errado.</p>
            <button type="button" className="voltar" onClick={() => go("/limites")}>Ler os limites do app</button>
          </div>
        </details>
      </div>
      <div className="acoes">
        <button type="button" className="btn btn-principal" onClick={() => go("/como-filmar")}>Novo vídeo</button>
      </div>
    </Screen>
  );
}

function SessionRow({ session }: { session: Session }) {
  const client = useClient();
  const capture = captureLine(session);
  return (
    <li>
      <button type="button" className="sessao" onClick={() => go(`/sessao/${session.session_id}`)}>
        {session.deletion === "none"
          ? <Thumb painter={client.openPainter(session.session_id)} frame={20} />
          : <span className="menor">Removendo</span>}
        <span>
          <b>{session.video.title}</b>
          <span className="linha-estado">{formatDate(session.created_at)}</span>
          <span className="linha-estado">{processingLine(session)}</span>
          {capture && <span className="linha-filmagem">{capture}</span>}
        </span>
      </button>
    </li>
  );
}

export function Guide() {
  return (
    <Screen title="Como filmar sozinho" back={{ label: "Voltar", onClick: () => go("/") }}>
      <CaptureDiagram />
      <ol className="lateral">
        <li><b>Apoie o celular de lado para você.</b> Na cerca, na mochila ou num tripé. Ninguém precisa segurar.</li>
        <li><b>Levante a raquete e confira a tela.</b> Raquete, cabeça e pés precisam caber. Em pé ou deitado, tanto faz.</li>
        <li><b>Grave com a câmera normal.</b> Sem câmera lenta.</li>
        <li><b>Faça seu saque de sempre.</b> Até 1 minuto de vídeo basta.</li>
      </ol>
      <div className="detalhes">
        <details className="detalhe">
          <summary>E se estiver sol forte?</summary>
          <div><p>Deixe o celular na sombra, se puder. No sol, ele pode esquentar e parar de gravar.</p></div>
        </details>
      </div>
      <div className="acoes">
        <button type="button" className="btn btn-principal" onClick={() => go("/escolher")}>Já gravei: escolher vídeo</button>
      </div>
    </Screen>
  );
}

function CaptureDiagram() {
  return (
    <svg className="diagrama" viewBox="0 0 340 214" role="img" aria-label="Vista de cima: o jogador atrás da linha de fundo, com o celular apoiado ao lado dele, apontado para ele. Na tela do celular, raquete levantada, cabeça e pés cabem inteiros.">
      {/* Vista de cima: a quadra fica acima da linha; o jogador olha para a rede. */}
      <text x="8" y="30" fill="#DCE6F7" fontSize="15">Quadra</text>
      <path d="M8 42H192" stroke="#fff" strokeWidth="4" />
      <text x="8" y="62" fill="#DCE6F7" fontSize="15">Linha de fundo</text>
      <path d="M156 118 L60 84 L60 152 Z" fill="#E4F222" opacity=".28" />
      <circle cx="46" cy="118" r="13" fill="#E4F222" />
      <circle cx="60" cy="104" r="6" fill="none" stroke="#E4F222" strokeWidth="3" />
      <rect x="156" y="100" width="24" height="36" rx="4" fill="#fff" />
      <text x="28" y="156" fill="#fff" fontSize="15" fontWeight="700">Você</text>
      <text x="138" y="156" fill="#fff" fontSize="15" fontWeight="700">Celular</text>
      {/* Tela do celular */}
      <rect x="206" y="4" width="128" height="206" rx="14" fill="#0C2A63" stroke="#fff" strokeWidth="3" />
      <g stroke="#E4F222" strokeWidth="6" strokeLinecap="round" fill="none">
        <path d="M268 62V104" />
        <path d="M268 104L254 142L248 182" />
        <path d="M268 104L284 142L290 182" />
        <path d="M268 72L246 96" />
        <path d="M268 70L288 44" />
      </g>
      <circle cx="268" cy="50" r="9" fill="#E4F222" />
      <ellipse cx="298" cy="28" rx="11" ry="14" fill="none" stroke="#E4F222" strokeWidth="4" transform="rotate(30 298 28)" />
      <g stroke="#fff" strokeWidth="3" fill="none">
        <path d="M218 24V14H230" /><path d="M322 24V14H310" />
        <path d="M218 188V198H230" /><path d="M322 188V198H310" />
      </g>
    </svg>
  );
}

export function PickVideo() {
  const client = useClient();
  const [selected, setSelected] = useState<string | null>(null);
  const videos = client.listLocalVideos();
  return (
    <Screen title="Escolha o vídeo" back={{ label: "Voltar", onClick: () => go("/como-filmar") }}>
      <p style={{ marginBottom: 16 }}>Esta demonstração usa vídeos simulados. Cada um mostra uma situação diferente.</p>
      <ul className="videos">
        {videos.map((v) => (
          <li key={v.id}>
            <button type="button" className="video-opcao" aria-pressed={selected === v.id} onClick={() => setSelected(v.id)}>
              <Thumb painter={client.openLocalPainter(v.id)} frame={20} />
              <span>
                <b>{v.title}</b>
                {v.recommended && <span className="recomendado">Comece por este</span>}
                <span>{v.situation}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="menor" style={{ marginBottom: 8 }}>
        No app real, o vídeo vai para um armazenamento privado e você pode excluí-lo quando quiser. Aqui, nada sai do aparelho.
      </p>
      <div className="acoes">
        <button
          type="button" className="btn btn-principal" disabled={!selected}
          onClick={async () => {
            if (!selected) return;
            const s = await client.createSession(selected);
            go(`/sessao/${s.session_id}`);
          }}
        >
          {selected ? "Enviar vídeo" : "Escolha um vídeo para enviar"}
        </button>
      </div>
    </Screen>
  );
}

export function UploadView({ session, refresh }: { session: Session; refresh: () => void }) {
  const client = useClient();
  const { bytes_sent, bytes_total, state } = session.upload;
  const percent = Math.floor((bytes_sent / bytes_total) * 100);
  if (state === "interrupted") {
    return (
      <Screen title="O envio parou">
        <p className="lead">A internet caiu. O vídeo continua no seu celular e o envio volta de onde parou.</p>
        <div className="envio" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Envio"><i style={{ width: `${percent}%` }} /></div>
        <p className="menor">{formatBytes(bytes_sent)} de {formatBytes(bytes_total)} enviados</p>
        <div className="acoes">
          <button type="button" className="btn btn-principal" onClick={async () => { await client.resumeUpload(session.session_id); refresh(); }}>Continuar envio</button>
        </div>
      </Screen>
    );
  }
  return (
    <Screen title="Enviando o vídeo">
      <p className="lead">{session.video.title}</p>
      <div className="envio" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Envio"><i style={{ width: `${percent}%` }} /></div>
      <p className="menor">{formatBytes(bytes_sent)} de {formatBytes(bytes_total)}</p>
    </Screen>
  );
}

export function RejectedView({ session }: { session: Session }) {
  const copy = (session.rejection && REJECTION_COPY[session.rejection.code]) || REJECTION_FALLBACK;
  return (
    <Screen title={copy.title} back={{ label: "Seus saques", onClick: () => go("/") }}>
      <p className="lead">{copy.why}</p>
      <p><b>{copy.action}</b></p>
      <div className="acoes">
        <button type="button" className="btn btn-principal" onClick={() => go("/escolher")}>Escolher outro vídeo</button>
      </div>
    </Screen>
  );
}

export function Limits() {
  return (
    <Screen title="O que o app faz e o que não faz" back={{ label: "Voltar", onClick: () => history.back() }}>
      <ul className="lateral">
        <li><b>O esqueleto é uma estimativa.</b> Um modelo calcula onde estão as articulações. Às vezes erra, sobretudo em movimentos rápidos. Confira com os próprios olhos.</li>
        <li><b>Um ponto que falta não é zero.</b> Quando o app não tem como marcar um ponto, ele não desenha nada ali.</li>
        <li><b>Não existe nota de técnica.</b> Nem ângulo ideal, nem comparação com profissionais.</li>
        <li><b>Não é diagnóstico.</b> Se sentir dor, procure um profissional de saúde.</li>
        <li><b>Não promete melhora.</b> Mostrar o vídeo ajuda você a observar. Ainda não medimos se isso melhora o saque.</li>
      </ul>
    </Screen>
  );
}
