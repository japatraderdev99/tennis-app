/** Local presentation seam. This does not implement HTTP/video decoding or infer pose. */
export interface FramePainter {
  width: number;
  height: number;
  paint(ctx: CanvasRenderingContext2D, frameIndex: number): void;
}

export interface PresentedFrame {
  frameIndex: number;
  paint(ctx: CanvasRenderingContext2D): void;
}

export interface FrameSource {
  width: number;
  height: number;
  present(frameIndex: number, signal: AbortSignal): Promise<PresentedFrame>;
}

/** Existing mock renderer adapted explicitly. No real image can enter this factory. */
export function syntheticFrameSource(painter: FramePainter): FrameSource {
  return {
    width: painter.width, height: painter.height,
    async present(frameIndex, signal) {
      signal.throwIfAborted();
      if (!Number.isSafeInteger(frameIndex) || frameIndex < 0) throw new Error("Invalid frame index");
      return { frameIndex, paint: (ctx) => painter.paint(ctx, frameIndex) };
    },
  };
}

/** Cancel stale seeks; confirm the returned frame before making its overlay visible. */
export function framePresenter(
  source: FrameSource,
  commit: (frame: PresentedFrame) => void,
  fail: (error: unknown) => void,
) {
  let generation = 0;
  let current: AbortController | undefined;
  return {
    async show(frameIndex: number) {
      const mine = ++generation;
      current?.abort();
      const controller = new AbortController();
      current = controller;
      try {
        const frame = await source.present(frameIndex, controller.signal);
        if (controller.signal.aborted || mine !== generation) return;
        if (frame.frameIndex !== frameIndex) throw new Error("Presented frame does not match requested source frame");
        commit(frame);
      } catch (error) {
        if (!controller.signal.aborted && mine === generation) fail(error);
      }
    },
    dispose() { ++generation; current?.abort(); },
  };
}
