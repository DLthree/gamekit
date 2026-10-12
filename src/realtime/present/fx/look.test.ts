import { describe, expect, it } from "vitest";
import type { FxKind } from "@/realtime/content/schema/look-fx";
import { fxDraw, newFxDraw } from "@/realtime/present/fx/look";
import type { FxInstance } from "@/realtime/present/fx/pool";

const kind: FxKind = {
  texture: "smoke",
  variants: null,
  cap: 10,
  evict: false,
  band: "fx",
  tint: "white",
  life: 1,
  growS: 0.5,
  scaleFrom: 0.5,
  scaleTo: 1,
  popS: 0.1,
  fadeFrom: 0.5,
  alpha: 0.8,
  drag: 0,
  rise: 10,
  flicker: 0,
  flickerHz: 0,
  sway: null,
};

const inst: FxInstance = {
  kind: "puff",
  slot: 0,
  alive: true,
  x: 10,
  y: 20,
  vx: 30,
  vy: 0,
  at: 2,
  life: 1,
  size: 40,
  rot: 0,
  spin: 1,
  variant: 3,
  tint: 0xffffff,
  alpha: 1,
  seed: 0,
};

describe("fxDraw", () => {
  it("is invisible before its start and after its life", () => {
    expect(fxDraw(inst, kind, 1.99, newFxDraw()).visible).toBe(false);
    expect(fxDraw(inst, kind, 3, newFxDraw()).visible).toBe(false);
  });

  it("grows from scaleFrom to scaleTo and holds", () => {
    expect(fxDraw(inst, kind, 2, newFxDraw()).w).toBeCloseTo(20);
    expect(fxDraw(inst, kind, 2.6, newFxDraw()).w).toBeCloseTo(40);
  });

  it("pops in, holds, then fades out from fadeFrom", () => {
    expect(fxDraw(inst, kind, 2.05, newFxDraw()).alpha).toBeCloseTo(0.4);
    expect(fxDraw(inst, kind, 2.4, newFxDraw()).alpha).toBeCloseTo(0.8);
    expect(fxDraw(inst, kind, 2.75, newFxDraw()).alpha).toBeCloseTo(0.4);
  });

  it("moves with its velocity and rises", () => {
    const d = fxDraw(inst, kind, 2.5, newFxDraw());
    expect(d.x).toBeCloseTo(25);
    expect(d.y).toBeCloseTo(15);
    expect(d.rot).toBeCloseTo(0.5);
    expect(d.variant).toBe(3);
  });

  it("slows under drag", () => {
    const d = fxDraw(inst, { ...kind, drag: 4 }, 2.5, newFxDraw());
    expect(d.x).toBeCloseTo(10 + (30 * (1 - Math.exp(-2))) / 4);
  });
});

describe("fxDraw sway", () => {
  const swaying: FxKind = {
    ...kind,
    sway: { amount: 0.1, hz: 0.5, breathe: 0.1, breatheHz: 0.8, swapS: 2 },
  };

  it("sways and breathes each instance out of phase, within its amount", () => {
    const a = fxDraw({ ...inst, spin: 0, seed: 0.1 }, swaying, 2.5, newFxDraw());
    const b = fxDraw({ ...inst, spin: 0, seed: 0.6 }, swaying, 2.5, newFxDraw());
    expect(a.rot).not.toBeCloseTo(b.rot, 3);
    expect(Math.abs(a.rot)).toBeLessThanOrEqual(0.1);
    expect(a.h / a.w).not.toBeCloseTo(b.h / b.w, 3);
  });

  it("swaps to the next frame every swapS seconds", () => {
    const long = { ...inst, at: 0, life: 10, seed: 0 };
    expect(fxDraw(long, swaying, 0, newFxDraw()).variant).toBe(3);
    expect(fxDraw(long, swaying, 4.1, newFxDraw()).variant).toBe(5);
  });

  it("leaves kinds without sway alone", () => {
    const d = fxDraw({ ...inst, spin: 0 }, kind, 2.5, newFxDraw());
    expect(d.rot).toBe(0);
    expect(d.variant).toBe(3);
  });
});
