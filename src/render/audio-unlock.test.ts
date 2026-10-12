import { describe, expect, it, vi } from "vitest";
import { AudioUnlock } from "@/render/audio-unlock";

function context(state: string) {
  const ctx = {
    state,
    resume: vi.fn(async () => {
      ctx.state = "running";
    }),
  };
  return ctx;
}

const flush = () => new Promise((done) => setTimeout(done, 0));

describe("AudioUnlock", () => {
  it("resumes a suspended context on the first touch, then leaves it alone", async () => {
    const target = new EventTarget();
    const ctx = context("suspended");
    const u = new AudioUnlock(ctx, target);
    expect(u.running).toBe(false);
    target.dispatchEvent(new Event("touchend"));
    await flush();
    expect(u.running).toBe(true);
    target.dispatchEvent(new Event("touchend"));
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });

  it("resumes again after an iOS interruption", async () => {
    const target = new EventTarget();
    const ctx = context("running");
    const u = new AudioUnlock(ctx, target);
    ctx.state = "interrupted";
    expect(u.running).toBe(false);
    target.dispatchEvent(new Event("pointerup"));
    await flush();
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(u.running).toBe(true);
  });

  it("counts a rejected resume instead of leaving an unhandled rejection", async () => {
    const target = new EventTarget();
    const ctx = { state: "suspended", resume: vi.fn(() => Promise.reject(new Error("denied"))) };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const u = new AudioUnlock(ctx, target);
    target.dispatchEvent(new Event("keydown"));
    await flush();
    expect(u.failures).toBe(1);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("keeps one resume in flight, so failures count attempts, not frames", async () => {
    const target = new EventTarget();
    const ctx = { state: "suspended", resume: vi.fn(() => Promise.reject(new Error("denied"))) };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const u = new AudioUnlock(ctx, target);
    for (let i = 0; i < 60; i++) u.resume();
    await flush();
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(u.failures).toBe(1);
    u.resume();
    await flush();
    expect(ctx.resume).toHaveBeenCalledTimes(2);
    expect(u.failures).toBe(2);
    warn.mockRestore();
  });

  it("a touch resumes even while a frame's resume never settled (iOS leaves it pending)", async () => {
    const target = new EventTarget();
    const ctx = {
      state: "suspended",
      resume: vi.fn(() => new Promise<void>(() => {})),
    };
    const u = new AudioUnlock(ctx, target);
    u.resume();
    u.resume();
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    target.dispatchEvent(new Event("touchend"));
    target.dispatchEvent(new Event("touchend"));
    expect(ctx.resume).toHaveBeenCalledTimes(3);
  });

  it("counts every failure of a streak but warns once, and again after audio ran", async () => {
    const target = new EventTarget();
    let refuse = true;
    const ctx = {
      state: "suspended",
      resume: vi.fn(async () => {
        if (refuse) throw new Error("denied");
        ctx.state = "running";
      }),
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const u = new AudioUnlock(ctx, target);
    for (let i = 0; i < 3; i++) {
      u.resume();
      await flush();
    }
    expect(u.failures).toBe(3);
    expect(warn).toHaveBeenCalledTimes(1);
    refuse = false;
    u.resume();
    await flush();
    expect(u.running).toBe(true);
    ctx.state = "interrupted";
    refuse = true;
    u.resume();
    await flush();
    u.resume();
    await flush();
    expect(u.failures).toBe(5);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("stops listening when released", () => {
    const target = new EventTarget();
    const ctx = context("suspended");
    new AudioUnlock(ctx, target).release();
    target.dispatchEvent(new Event("touchend"));
    expect(ctx.resume).not.toHaveBeenCalled();
  });
});
