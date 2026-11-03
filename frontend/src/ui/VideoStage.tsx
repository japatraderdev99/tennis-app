import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { framePresenter, syntheticFrameSource, type FrameSource, type FramePainter, type PresentedFrame } from "../api/media";
import type { ReplayKeypoint } from "../api/types";
import { paintSkeleton } from "./skeleton";

type Props = {
  frame: number;
  keypoints?: ReplayKeypoint[] | null;
  label: string;
  children?: ReactNode;
} & ({ painter: FramePainter; source?: never } | { source: FrameSource; painter?: never });

/** Paint only the confirmed requested frame; this mock adapter does not decode video. */
export function VideoStage({ painter, source: external, frame, keypoints, label, children }: Props) {
  const source = useMemo(() => external ?? syntheticFrameSource(painter!), [external, painter]);
  const ref = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let active = true;
    let presented: PresentedFrame | undefined;
    setState("loading");
    const draw = () => {
      if (!active || !presented) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const box = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(box.width * dpr));
      const h = Math.max(1, Math.round(box.height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      const scale = w / source.width;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      presented.paint(ctx);
      if (keypoints) paintSkeleton(ctx, keypoints, (3 * dpr) / scale);
    };
    const presenter = framePresenter(source, (confirmed) => {
      presented = confirmed;
      draw();
      setState("ready");
    }, () => { presented = undefined; setState("error"); });
    void presenter.show(frame);
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    // A marca "Vídeo simulado" usa a fonte do app: redesenha quando ela carregar.
    void document.fonts?.ready.then(draw);
    return () => { active = false; presenter.dispose(); observer.disconnect(); };
  }, [source, frame, keypoints, retry]);

  return (
    <div className="palco" style={{ aspectRatio: `${source.width} / ${source.height}` }} aria-busy={state === "loading"} data-error={state === "error"}>
      <canvas ref={ref} role="img" aria-label={label} />
      {state === "loading" && <span className="so-leitor" role="status">Abrindo quadro.</span>}
      {state === "error" && <div role="alert">Não consegui abrir este quadro.<button className="btn-texto" onClick={() => setRetry((n) => n + 1)}>Tentar abrir de novo</button></div>}
      {state === "ready" && children}
    </div>
  );
}
