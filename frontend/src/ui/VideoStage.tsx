import { useEffect, useRef, type ReactNode } from "react";
import type { FramePainter } from "../api/client";
import type { ReplayKeypoint } from "../api/types";
import { paintSkeleton } from "./skeleton";

/** Quadro do vídeo com o esqueleto opcional, em um único canvas para nunca desalinhar. */
export function VideoStage({ painter, frame, keypoints, label, children }: {
  painter: FramePainter;
  frame: number;
  keypoints?: ReplayKeypoint[] | null;
  label: string;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const box = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(box.width * dpr));
      const h = Math.max(1, Math.round(box.height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      const scale = w / painter.width;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      painter.paint(ctx, frame);
      if (keypoints) paintSkeleton(ctx, keypoints, (3 * dpr) / scale);
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    // A marca "Vídeo simulado" usa a fonte do app: redesenha quando ela carregar.
    void document.fonts?.ready.then(draw);
    return () => observer.disconnect();
  }, [painter, frame, keypoints]);

  return (
    <div className="palco" style={{ aspectRatio: `${painter.width} / ${painter.height}` }}>
      <canvas ref={ref} role="img" aria-label={label} />
      {children}
    </div>
  );
}
