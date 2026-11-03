import { describe, expect, it, vi } from "vitest";
import { framePresenter, type PresentedFrame, type FrameSource } from "../src/api/media";

describe("asynchronous presentation evidence", () => {
  it("discards a seek that finishes after its replacement", async () => {
    const pending = new Map<number, (frame: PresentedFrame) => void>();
    const source: FrameSource = { width: 10, height: 10, present: (index) => new Promise((r) => pending.set(index, r)) };
    const commit = vi.fn(); const fail = vi.fn();
    const controller = framePresenter(source, commit, fail);
    const old = controller.show(1); const recent = controller.show(2);
    pending.get(2)!({ frameIndex: 2, paint() {} }); await recent;
    pending.get(1)!({ frameIndex: 1, paint() {} }); await old;
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0]![0].frameIndex).toBe(2);
    expect(fail).not.toHaveBeenCalled();
  });
  it("does not draw a mismatched frame or after disposal", async () => {
    const commit = vi.fn(); const fail = vi.fn();
    const source: FrameSource = { width: 10, height: 10, async present() { return { frameIndex: 9, paint() {} }; } };
    const controller = framePresenter(source, commit, fail);
    await controller.show(3);
    expect(commit).not.toHaveBeenCalled(); expect(fail).toHaveBeenCalledTimes(1);
    const pending = controller.show(9); controller.dispose(); await pending;
    expect(commit).not.toHaveBeenCalled();
  });
  it("reports failure and allows a fresh attempt", async () => {
    let attempts = 0;
    const source: FrameSource = { width: 10, height: 10, async present(frameIndex) {
      if (!attempts++) throw new Error("decode unavailable");
      return { frameIndex, paint() {} };
    } };
    const commit = vi.fn(); const fail = vi.fn(); const controller = framePresenter(source, commit, fail);
    await controller.show(4); await controller.show(4);
    expect(fail).toHaveBeenCalledTimes(1); expect(commit).toHaveBeenCalledTimes(1);
  });
});
