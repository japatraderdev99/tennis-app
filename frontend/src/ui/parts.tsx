import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { ApiClient, FramePainter } from "../api/client";

const ClientContext = createContext<ApiClient | null>(null);
export const ClientProvider = ClientContext.Provider;
export function useClient(): ApiClient {
  const client = useContext(ClientContext);
  if (!client) throw new Error("ApiClient ausente");
  return client;
}

/** Tela com título focado ao entrar: leitores de tela anunciam a mudança. */
export function Screen({ title, children, back, hero, compact }: {
  title: string; children: ReactNode; back?: { label: string; onClick: () => void }; hero?: ReactNode;
  /** Título pequeno acima do herói: na revisão, o vídeo e seus controles ficam colados. */
  compact?: boolean;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    document.title = `${title}: Quadro (dados simulados)`;
  }, [title]);
  return (
    <main className="tela">
      {!compact && hero}
      {back && <button type="button" className="voltar" onClick={back.onClick}>{back.label}</button>}
      <h1 className={compact ? "titulo titulo-compacto" : "titulo"} tabIndex={-1} ref={ref}>{title}</h1>
      {compact && hero}
      {children}
    </main>
  );
}

/** Consulta periódica, como será contra a API. */
export function usePolling<T>(load: () => Promise<T>, intervalMs: number, deps: unknown[]): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    let alive = true;
    const tick = () => load().then((v) => { if (alive) setValue(v); });
    void tick();
    if (intervalMs <= 0) return () => { alive = false; };
    const id = window.setInterval(tick, intervalMs);
    return () => { alive = false; window.clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

/** Miniatura de um quadro. O canvas é decorativo; o texto ao lado carrega a informação. */
export function Thumb({ painter, frame }: { painter: FramePainter; frame: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const size = 160;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Corte quadrado centralizado.
    const scale = size / Math.min(painter.width, painter.height);
    ctx.setTransform(scale, 0, 0, scale, (size - painter.width * scale) / 2, (size - painter.height * scale) / 2);
    painter.paint(ctx, frame);
  }, [painter, frame]);
  return <canvas ref={ref} aria-hidden="true" />;
}

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
