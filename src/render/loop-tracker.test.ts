import { describe, expect, it, vi } from "vitest";
import { LoopTracker } from "@/render/loop-tracker";

/**
 * `AudioOut.play`'s loop path (Ruling P10) delegates the start/stop bookkeeping to LoopTracker so
 * it's testable without a real AudioContext: `add` mirrors `manager.add(...).play()`, `update`
 * mirrors the wave's per-tick presentation time driving the destroy (Review I1: destroy, not
 * stop, or the sound and its audio nodes leak in the manager's `sounds` list).
 */
describe("LoopTracker (Ruling P10)", () => {
  it("leaves a loop running before its end time, then destroys it once time reaches it", () => {
    const tracker = new LoopTracker();
    const sound = { destroy: vi.fn() };
    tracker.add(sound, 4);
    tracker.update(3.99);
    expect(sound.destroy).not.toHaveBeenCalled();
    tracker.update(4);
    expect(sound.destroy).toHaveBeenCalledTimes(1);
    // Already destroyed: later ticks don't touch it again.
    tracker.update(5);
    expect(sound.destroy).toHaveBeenCalledTimes(1);
  });

  it("tracks multiple loops independently, only destroying the one whose end has passed", () => {
    const tracker = new LoopTracker();
    const a = { destroy: vi.fn() };
    const b = { destroy: vi.fn() };
    tracker.add(a, 2);
    tracker.add(b, 6);
    tracker.update(2);
    expect(a.destroy).toHaveBeenCalledTimes(1);
    expect(b.destroy).not.toHaveBeenCalled();
    tracker.update(6);
    expect(b.destroy).toHaveBeenCalledTimes(1);
  });

  it("destroys every live loop on teardown, regardless of its end time", () => {
    const tracker = new LoopTracker();
    const a = { destroy: vi.fn() };
    const b = { destroy: vi.fn() };
    tracker.add(a, 4);
    tracker.add(b, 100);
    tracker.stopAll();
    expect(a.destroy).toHaveBeenCalledTimes(1);
    expect(b.destroy).toHaveBeenCalledTimes(1);
    // Nothing left to destroy a second time.
    tracker.update(1000);
    expect(a.destroy).toHaveBeenCalledTimes(1);
    expect(b.destroy).toHaveBeenCalledTimes(1);
  });
});
