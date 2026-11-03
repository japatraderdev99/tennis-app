import { useEffect, useRef, useState } from "react";
import type { Moment, ReviewVideo } from "./types";
import { formatPlayback, readMoments, validateLoop, writeMoments } from "./moments";
import { Icon } from "./icons";

export function RealReview({ video, onBack }: { video: ReviewVideo; onBack: () => void }) {
  const media = useRef<HTMLVideoElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const restored = useRef(false);
  const [duration, setDuration] = useState(video.duration_seconds);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [rate, setRate] = useState(1);
  const [muted, setMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loopStart, setLoopStart] = useState<number | null>(null);
  const [loopEnd, setLoopEnd] = useState<number | null>(null);
  const [looping, setLooping] = useState(false);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const loopValid = loopStart !== null && loopEnd !== null && validateLoop(loopStart, loopEnd, duration);

  useEffect(() => { document.title = `${video.title} — Quadro`; heading.current?.focus({ preventScroll: true }); }, [video.title]);
  useEffect(() => { if (editing) editor.current?.focus({ preventScroll: true }); }, [editing]);
  useEffect(() => {
    const changed = () => setIsFullscreen(document.fullscreenElement === stage.current);
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);

  const persist = (next: Moment[]) => {
    setMoments(next);
    if (video.origin === "catalog") {
      try {
        if (!writeMoments(localStorage, video.id, next)) {
          setStorageAvailable(false); setNotice("A anotação está nesta aba, mas o navegador não conseguiu guardá-la. Exporte seus momentos antes de sair."); return false;
        }
        setStorageAvailable(true);
      } catch { setStorageAvailable(false); setNotice("O navegador bloqueou o armazenamento. Exporte seus momentos antes de sair."); return false; }
    }
    return true;
  };
  const loaded = () => {
    const el = media.current;
    if (!el || !Number.isFinite(el.duration) || el.duration <= 0) { setError("O navegador não conseguiu ler a duração deste vídeo."); return; }
    setDuration(el.duration); setReady(true); setError("");
    if (!restored.current && video.origin === "catalog") {
      restored.current = true;
      try {
        let available = true;
        const storage = localStorage;
        const saved = readMoments({ getItem(key) {
          try { return storage.getItem(key); } catch { available = false; return null; }
        } }, video.id, el.duration);
        setMoments(saved); setStorageAvailable(available);
        if (!available) setNotice("Seus momentos ficarão apenas nesta aba. Exporte antes de fechar esta revisão.");
      } catch { setStorageAvailable(false); setNotice("Seus momentos ficarão apenas nesta aba. Exporte antes de fechar esta revisão."); }
    }
  };
  const seek = (seconds: number) => {
    const el = media.current;
    if (!el || !ready) return;
    const next = Math.max(0, Math.min(duration, seconds));
    if (looping && loopStart !== null && loopEnd !== null && (next < loopStart || next >= loopEnd)) setLooping(false);
    el.currentTime = next; setTime(next);
  };
  const toggle = async () => {
    const el = media.current;
    if (!el) return;
    if (!el.paused) { el.pause(); return; }
    if (looping && loopValid && loopStart !== null && loopEnd !== null && (el.currentTime < loopStart || el.currentTime >= loopEnd)) el.currentTime = loopStart;
    try { await el.play(); setNotice(""); } catch { setNotice("Não foi possível reproduzir. Tente novamente ou abra um MP4 compatível."); }
  };
  const syncTime = () => {
    const el = media.current;
    if (!el) return;
    if (looping && loopValid && loopEnd !== null && loopStart !== null && el.currentTime >= loopEnd) {
      el.currentTime = loopStart; setTime(loopStart);
    } else setTime(el.currentTime);
  };
  const mark = () => {
    const el = media.current;
    if (!el || !ready || moments.length >= 200) return;
    el.pause();
    const moment = { id: crypto.randomUUID(), time_seconds: Math.min(duration, Math.max(0, el.currentTime)), note: "" };
    setNotice(""); persist([...moments, moment].sort((a, b) => a.time_seconds - b.time_seconds));
    setEditing(moment.id); setDraft("");
  };
  const removeMoment = (id: string) => {
    persist(moments.filter(m => m.id !== id));
    if (editing === id) { setEditing(null); setDraft(""); }
  };
  const exportMoments = () => {
    const data = { kind: "manual_observations", clock: "edited_file_playback_seconds", video_title: video.title,
      source: video.origin, duration_seconds: duration, moments, biomechanical_analysis: "not_run" };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "quadro-meus-momentos.json"; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const fullscreen = async () => {
    try { if (!document.fullscreenElement) await stage.current?.requestFullscreen(); else await document.exitFullscreen(); }
    catch { setNotice("Tela cheia não está disponível neste navegador. Você pode girar o celular para ampliar o vídeo."); }
  };

  return <main id="real-content" className="r-review">
    <button className="r-back" onClick={onBack}><Icon name="back" />Seus vídeos</button>
    <div className="r-review-title"><h1 tabIndex={-1} ref={heading}>{video.title}</h1><span className="r-status-label">Revisão local do vídeo</span></div>
    <div className="r-review-grid">
      <section className="r-review-media" aria-label="Reprodução do vídeo">
        <div className="r-player" ref={stage}>
          <video ref={media} src={video.media_url} poster={video.poster_url ?? undefined} playsInline preload="metadata" muted={muted} controls={isFullscreen}
            aria-label={`Vídeo: ${video.title}`} onLoadedMetadata={loaded} onDurationChange={() => { if (ready) loaded(); }}
            onTimeUpdate={syncTime} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
            onEnded={() => { if (looping && loopValid && loopStart !== null && media.current) { media.current.currentTime = loopStart; void media.current.play().catch(() => setNotice("Toque em Reproduzir para continuar o trecho.")); } else setPlaying(false); }}
            onError={() => { setError("Não foi possível abrir este vídeo. O formato pode não ser aceito pelo navegador, ou o arquivo local mudou."); setReady(false); setPlaying(false); }} />
          {!playing && ready && !error && !isFullscreen && <button className="r-center-play" aria-label="Reproduzir vídeo" onClick={() => void toggle()}><Icon name="play" size={32} /></button>}
          {error && <div className="r-player-error" role="alert"><h2>Este vídeo não abriu</h2><p>{error}</p><button className="r-button" onClick={() => { setError(""); media.current?.load(); }}>Tentar novamente</button><button className="r-button" onClick={onBack}>Voltar aos vídeos</button></div>}
        </div>
        <div className="r-player-controls">
          <div className="r-clock"><span aria-live="off" data-testid="real-time">{formatPlayback(time)}</span><span>{formatPlayback(duration)}</span></div>
          <div className="r-timeline">
            {loopValid && loopStart !== null && loopEnd !== null && <span className="r-loop-range" style={{ left: `${loopStart / duration * 100}%`, width: `${(loopEnd - loopStart) / duration * 100}%` }} />}
            <input type="range" min="0" max={duration || 1} step="0.1" value={Math.min(time, duration || 1)} aria-label="Posição no vídeo real" aria-valuetext={formatPlayback(time)} disabled={!ready} onChange={e => seek(Number(e.target.value))} />
          </div>
          <div className="r-transport">
            <button className="r-play" disabled={!ready} aria-label={playing ? "Pausar" : "Reproduzir"} onClick={() => void toggle()}><Icon name={playing ? "pause" : "play"} /><span>{playing ? "Pausar" : "Reproduzir"}</span></button>
            <button className="r-transport-text" disabled={!ready} onClick={() => seek(time - 2)} aria-label="Voltar 2 segundos">−2 s</button>
            <button className="r-transport-text" disabled={!ready} onClick={() => seek(time + 2)} aria-label="Avançar 2 segundos">+2 s</button>
            <label className="r-speed"><span className="r-sr">Velocidade de reprodução</span><select value={rate} disabled={!ready} onChange={e => { const next = Number(e.target.value); setRate(next); if (media.current) media.current.playbackRate = next; }}><option value="0.25">0,25×</option><option value="0.5">0,5×</option><option value="1">1×</option><option value="1.5">1,5×</option></select></label>
            <button className="r-icon-button" aria-label={muted ? "Ativar áudio" : "Silenciar"} onClick={() => setMuted(!muted)}><Icon name={muted ? "mute" : "volume"} /></button>
            <button className="r-icon-button" aria-label="Tela cheia" onClick={() => void fullscreen()}><Icon name="expand" /></button>
          </div>
        </div>
        <div className="r-review-actions"><button className="r-button r-primary" disabled={!ready || moments.length >= 200} onClick={mark}><Icon name="mark" />Marcar momento</button><span>Pause para olhar. Marque para voltar.</span></div>
        {notice && <p className="r-notice" role="status">{notice}</p>}
        <details className="r-loop-panel"><summary><Icon name="repeat" />Repetir um trecho<span>{looping ? "Ligado" : "Definir início e fim"}</span></summary><div>
          <p>Vá ao início do trecho e marque. Depois, faça o mesmo com o fim.</p>
          <div className="r-loop-buttons"><button disabled={!ready} onClick={() => { setLoopStart(media.current?.currentTime ?? time); setLooping(false); }}>Marcar início <b>{loopStart === null ? "—" : formatPlayback(loopStart)}</b></button><button disabled={!ready} onClick={() => { setLoopEnd(media.current?.currentTime ?? time); setLooping(false); }}>Marcar fim <b>{loopEnd === null ? "—" : formatPlayback(loopEnd)}</b></button><button className="r-button r-secondary" disabled={!loopValid} aria-pressed={looping} onClick={() => { if (!looping && loopStart !== null) seek(loopStart); setLooping(!looping); }}>{looping ? "Parar repetição" : "Repetir trecho"}</button></div>
          {loopStart !== null && loopEnd !== null && !loopValid && <p className="r-field-help">O fim precisa vir depois do início, com pelo menos 0,25 segundo de intervalo.</p>}
          {loopValid && <p className="r-field-help">A repetição usa o relógio de reprodução e pode variar ligeiramente no navegador.</p>}
        </div></details>
        <p className="r-analysis-note">Sem análise biomecânica vinculada. As marcações abaixo são suas observações.</p>
      </section>
      <aside className="r-moments" aria-label="Momentos e observações">
        <div className="r-moments-heading"><h2>Momentos para rever</h2><span>{moments.length}</span></div>
        {moments.length === 0 && <div className="r-moments-empty"><Icon name="mark" size={32} /><h3>O que chamou sua atenção?</h3><p>Marque um instante do vídeo. Você poderá voltar a ele e escrever o que percebeu.</p><p className="r-example">Por exemplo: “Rever minha preparação nesta troca”.</p></div>}
        <ul className="r-moment-list">{moments.map((m, index) => <li key={m.id} className={editing === m.id ? "r-moment-selected" : ""}>
          <div className="r-moment-top"><button className="r-moment-time" onClick={() => { seek(m.time_seconds); media.current?.pause(); setEditing(m.id); setDraft(m.note); }} aria-label={`Rever momento em ${formatPlayback(m.time_seconds)}`}><Icon name="play" size={14} />{formatPlayback(m.time_seconds)}</button><span>Momento {index + 1}</span><button className="r-icon-button" onClick={() => removeMoment(m.id)} aria-label={`Remover momento em ${formatPlayback(m.time_seconds)}`}><Icon name="close" size={16} /></button></div>
          {editing === m.id ? <form onSubmit={e => { e.preventDefault(); const saved = persist(moments.map(x => x.id === m.id ? { ...x, note: draft } : x)); setEditing(null); if (saved) setNotice("Observação registrada."); }}><label htmlFor="moment-note">Sua observação</label><textarea id="moment-note" ref={editor} value={draft} maxLength={1000} rows={3} onChange={e => setDraft(e.target.value)} placeholder="O que você quer olhar com mais calma?" /><button className="r-button r-secondary" type="submit"><Icon name="check" size={16} />Salvar observação</button></form> : <button className="r-note-text" onClick={() => { setEditing(m.id); setDraft(m.note); }}>{m.note || "Adicionar uma observação"}</button>}
        </li>)}</ul>
        {moments.length > 0 && <button className="r-export" onClick={exportMoments}>Exportar meus momentos</button>}
        <p className="r-storage-copy">{video.origin === "catalog" && storageAvailable ? "Suas anotações ficam guardadas neste navegador." : "Suas anotações ficam nesta aba. Exporte antes de fechar esta revisão."}</p>
        <details className="r-video-details"><summary>Sobre esta revisão</summary><dl><dt>Origem</dt><dd>{video.origin === "catalog" ? "Biblioteca deste computador" : "Arquivo escolhido neste dispositivo"}</dd><dt>Tempo das marcações</dt><dd>Relógio deste arquivo. Não identifica o quadro exato nem o tempo de uma gravação original anterior à edição.</dd><dt>Vídeo original</dt><dd>Permanece intacto. Marcar, anotar ou remover um momento não altera o arquivo.</dd><dt>Análise automática</dt><dd>Não executada para este vídeo. Sem esqueleto, medidas ou nota de técnica.</dd></dl></details>
      </aside>
    </div>
  </main>;
}
