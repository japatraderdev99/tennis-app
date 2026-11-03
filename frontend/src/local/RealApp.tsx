import { useEffect, useRef, useState } from "react";
import type { CatalogVideo, LocalCatalog, ReviewVideo } from "./types";
import { RealReview } from "./RealReview";
import { Icon } from "./icons";
import "./real.css";

const durationLabel = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function RealApp() {
  const [catalog, setCatalog] = useState<CatalogVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ReviewVideo | null>(null);
  const [guide, setGuide] = useState(false);
  const [retry, setRetry] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    void fetch("/__local_media/catalog", { signal: controller.signal }).then(async (r) => {
      if (!r.ok) throw new Error("catalog unavailable");
      const data = await r.json() as LocalCatalog;
      if (data.version !== 1 || !Array.isArray(data.videos) || data.videos.some(v =>
        !v.media_url.startsWith("/__local_media/") || (v.poster_url !== null && !v.poster_url.startsWith("/__local_media/")))) throw new Error("invalid local catalog");
      if (!controller.signal.aborted) setCatalog(data.videos);
    }).catch(() => { if (!controller.signal.aborted) setError("Não foi possível abrir a biblioteca local. Você ainda pode escolher um arquivo do dispositivo."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => () => { if (selected?.origin === "file") URL.revokeObjectURL(selected.media_url); }, [selected]);
  useEffect(() => {
    if (!selected) { document.title = "Quadro — seus vídeos de tênis"; heading.current?.focus({ preventScroll: true }); }
    window.scrollTo(0, 0);
  }, [selected, guide]);

  const openFile = (file: File | undefined) => {
    if (!file) return;
    if (!/\.(mp4|mov|webm)$/i.test(file.name) || file.size === 0) {
      setError("Escolha um vídeo MP4, MOV ou WebM que não esteja vazio."); return;
    }
    setError(""); setGuide(false);
    setSelected({ id: `file-${crypto.randomUUID()}`, title: file.name.replace(/\.[^.]+$/, ""),
      duration_seconds: 0, width: 0, height: 0, size_bytes: file.size, edited: false,
      media_url: URL.createObjectURL(file), poster_url: null, origin: "file" });
  };
  const choose = () => input.current?.click();
  const home = () => { setSelected(null); setGuide(false); };

  return <div className="real-app">
    <a className="r-skip" href="#real-content">Pular para o conteúdo</a>
    <header className="r-header">
      <button className="r-brand" onClick={home} aria-label="Quadro, seus vídeos"><span className="r-brand-court" aria-hidden="true"><i /></span>Quadro</button>
      <nav aria-label="Navegação principal">
        <button aria-current={!guide ? "page" : undefined} onClick={home}>Seus vídeos</button>
        <button aria-current={guide ? "page" : undefined} onClick={() => { setSelected(null); setGuide(true); }}>Como filmar</button>
      </nav>
      <button className="r-button r-primary r-open" onClick={choose}><Icon name="plus" />Abrir vídeo</button>
      <input className="r-file-input" ref={input} type="file" accept="video/mp4,video/quicktime,video/webm,.mov" aria-label="Escolher vídeo do dispositivo" onChange={(e) => { openFile(e.target.files?.[0]); e.target.value = ""; }} />
    </header>
    {selected && error && <div className="r-alert" role="alert">{error}</div>}
    {selected ? <RealReview key={selected.id} video={selected} onBack={home} /> : <main id="real-content" className="r-library">
      {guide ? <>
        <div className="r-library-intro"><div><h1 ref={heading} tabIndex={-1}>Filme para conseguir rever.</h1><p>Uma gravação estável ajuda você a observar o que aconteceu.</p></div></div>
        <div className="r-guide-page">
          <ol className="r-guide-list">
            <li><b>Apoie o celular.</b><p>Use um tripé ou apoio firme, fora da área de jogo. Não é preciso alguém segurando.</p></li>
            <li><b>Confira o enquadramento.</b><p>Inclua o corpo inteiro e a raquete levantada. Faça um teste curto antes de jogar.</p></li>
            <li><b>Guarde a gravação original.</b><p>Use a câmera normal. Edições e câmera lenta podem mudar o tempo do movimento.</p></li>
          </ol>
          <aside><h2>Para observar agora</h2><p>Você pode abrir uma gravação editada e marcar momentos. Os tempos se referem a esse arquivo.</p><h2>Para medir depois</h2><p>O protocolo de captura ainda será validado. Esta revisão não libera medidas biomecânicas nem recomendações de técnica.</p><button className="r-button r-primary" onClick={choose}>Escolher meu vídeo</button></aside>
        </div>
      </> : <>
        <div className="r-library-intro">
          <div><h1 ref={heading} tabIndex={-1}>Seu jogo, visto de perto.</h1><p>Escolha um vídeo abaixo ou use “Abrir vídeo”. Pause no movimento que quer observar e clique em “Analisar este quadro”.</p><p className="r-mode-help">Pontos do corpo estimados em uma imagem real, com processamento local. Sem avaliação de técnica.</p></div>
          <p className="r-local-label"><span aria-hidden="true" />Revisão local<span className="r-local-small">Sem enviar seus vídeos</span></p>
        </div>
        {error && <div className="r-alert" role="alert"><p>{error}</p><button onClick={() => setRetry(n => n + 1)}>Tentar biblioteca novamente</button></div>}
        {loading && <p role="status" className="r-loading">Abrindo seus vídeos…</p>}
        {!loading && catalog.length > 0 && <section className="r-video-grid" aria-label="Vídeos disponíveis neste computador">
          {catalog.map((v, index) => <button key={v.id} className={`r-video-card ${index === 0 ? "r-featured" : ""}`} onClick={() => setSelected({ ...v, origin: "catalog" })}>
            <div className="r-card-image">{v.poster_url && <img src={v.poster_url} alt="" loading={index ? "lazy" : "eager"} />}<span className="r-card-play"><Icon name="play" size={24} /></span><span className="r-duration">{durationLabel(v.duration_seconds)}</span></div>
            <div className="r-card-caption"><h2>{v.title}</h2><p>{v.edited ? "Vídeo editado" : "Arquivo local"}<span>Rever vídeo</span></p></div>
          </button>)}
        </section>}
        {!loading && catalog.length === 0 && <section className="r-empty" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); openFile(e.dataTransfer.files[0]); }} aria-label="Abrir gravação local">
          <div className="r-empty-court" aria-hidden="true"><i /></div><h2>Comece com uma gravação sua.</h2><p>Arraste um vídeo para cá ou escolha um arquivo do dispositivo.</p><button className="r-button r-primary" onClick={choose}><Icon name="plus" />Escolher vídeo</button><small>MP4, MOV ou WebM. A reprodução depende do formato aceito pelo navegador.</small>
        </section>}
        <section className="r-observe-guide" aria-label="Como usar a revisão"><div><span className="r-step">1</span><h2>Encontre o momento</h2><p>Use a linha do tempo para voltar a uma troca.</p></div><div><span className="r-step">2</span><h2>Olhe com calma</h2><p>Reduza a velocidade ou repita um trecho.</p></div><div><span className="r-step">3</span><h2>Guarde sua percepção</h2><p>Marque um instante e escreva uma observação.</p></div></section>
      </>}
      <footer className="r-footer"><p>Seus vídeos ficam neste dispositivo. A análise de um quadro estima pontos do corpo; não avalia sua técnica.</p><button onClick={() => { setSelected(null); setGuide(!guide); }}>{guide ? "Voltar aos vídeos" : "Como filmar sozinho"}</button><a href="/?demo=1#/estados">Explorar a demonstração com esqueleto simulado</a></footer>
    </main>}
  </div>;
}
