import { describe, expect, it } from "vitest";
import type { Gait } from "@/realtime/content/schema/look";
import {
  applyLunge,
  applyRecoil,
  applySpring,
  bodyPose,
  deathLook,
  isFlashing,
  newDeathLook,
  newPose,
  spring,
} from "@/realtime/present/anim/layer1";

const waddle: Gait = {
  kind: "waddle",
  hz: 1,
  bob: 0.1,
  squash: 0.1,
  rock: 5,
  lean: 0,
  breath: 0.05,
  breathHz: 1,
  hover: 0,
};

describe("layer 1", () => {
  it("an idle creature only breathes", () => {
    const p = bodyPose(waddle, 40, 0.25, 0, newPose());
    expect(p.dy).toBe(0);
    expect(p.sy).toBeCloseTo(1.05);
    expect(p.rot).toBe(0);
  });

  it("a rigid object neither breathes nor walks; it only hovers", () => {
    const rigid: Gait = { ...waddle, kind: "rigid", hover: 3 };
    for (const walk of [0, 1]) {
      const p = bodyPose(rigid, 40, 0.25, walk, newPose());
      expect(p).toEqual({ dx: 0, dy: -3, sx: 1, sy: 1, rot: 0 });
    }
  });

  it("a walking waddle bounces up and rocks", () => {
    const p = bodyPose(waddle, 40, 0.25, 1, newPose());
    expect(p.dy).toBeCloseTo(-4);
    expect(p.rot).toBeCloseTo((5 * Math.PI) / 180);
  });

  it("a flyer hovers and keeps flapping when idle", () => {
    const flyer: Gait = { ...waddle, kind: "flap", hover: 16 };
    const p = bodyPose(flyer, 20, 0.3, 0, newPose());
    expect(p.dy).toBeLessThan(-10);
    expect(p.sy).not.toBeCloseTo(1, 5);
  });

  it("a spring starts at its amount, rings at hz and dies out", () => {
    const s = { amount: 0.2, hz: 5, decayS: 0.1 };
    expect(spring(0, s)).toBeCloseTo(0.2);
    expect(spring(0.1, s)).toBeCloseTo(0.2 * Math.exp(-1) * Math.cos(Math.PI));
    expect(spring(1, s)).toBe(0);
    expect(spring(-0.01, s)).toBe(0);
  });

  it("a spring squashes wide when positive and stretches tall when negative", () => {
    const wide = applySpring(0.1, newPose());
    expect([wide.sx, wide.sy]).toEqual([1.1, 0.9]);
    expect(applySpring(-0.1, newPose()).sy).toBeCloseTo(1.1);
  });

  it("a recoil shoves along its direction by a fraction of the height, then settles", () => {
    const r = { distance: 0.1, decayS: 0.1 };
    expect(applyRecoil(0, 40, r, -1, 0, newPose()).dx).toBeCloseTo(-4);
    expect(applyRecoil(0, 40, r, 0, 1, newPose()).dy).toBeCloseTo(4);
    expect(applyRecoil(1, 40, r, -1, 0, newPose())).toEqual(newPose());
  });

  it("a lunge reaches forward mid-way and is over after its duration", () => {
    const lunge = { durationS: 0.4, reach: 0.35, leanDeg: 14 };
    expect(applyLunge(0.26, 40, lunge, newPose()).dx).toBeGreaterThan(10);
    expect(applyLunge(0.5, 40, lunge, newPose())).toEqual(newPose());
  });

  it("a death pops, flashes first, then vanishes", () => {
    const death = { durationS: 0.34, pop: 0.35, spinDeg: 28 };
    const early = deathLook(0.05, death, newDeathLook());
    expect(early.flash).toBe(true);
    expect(early.scale).toBeGreaterThan(1);
    expect(deathLook(0.34, death, newDeathLook()).visible).toBe(false);
    expect(isFlashing(0.05, 0.09)).toBe(true);
    expect(isFlashing(0.1, 0.09)).toBe(false);
  });
});
