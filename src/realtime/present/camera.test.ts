import { describe, expect, it } from "vitest";
import { createRng } from "@/core/rng";
import {
  computeViewport,
  createCamera,
  followCamera,
  shakeOffset,
  startShake,
  updateLead,
  worldToCss,
} from "@/realtime/present/camera";

const arena = { $schema: "x", halfWidth: 900, halfHeight: 900, spawnRadius: 660 };

describe("camera", () => {
  it("fits the same world span across the short side in portrait and landscape", () => {
    const portrait = computeViewport(390, 844, 3, 3, 520);
    const landscape = computeViewport(844, 390, 3, 3, 520);
    expect(portrait.zoom).toBeCloseTo((390 * 3) / 520);
    expect(landscape.zoom).toBeCloseTo(portrait.zoom);
    expect(computeViewport(390, 844, 3, 2, 520).dpr).toBe(2);
  });

  it("follows the player's focus point and clamps to the arena", () => {
    const view = computeViewport(390, 844, 1, 1, 520);
    const cam = createCamera();
    followCamera(cam, view, 100, 50, arena, -20);
    expect([cam.x, cam.y]).toEqual([100, 30]);
    followCamera(cam, view, 890, 0, arena, 0);
    expect(cam.x).toBeCloseTo(900 - 260);
  });

  it("maps world to CSS pixels by translation and uniform zoom", () => {
    const view = computeViewport(400, 800, 2, 3, 400);
    const cam = createCamera();
    followCamera(cam, view, 0, 0, arena, 0);
    expect(worldToCss(cam, view, 0, 0)).toEqual({ x: 200, y: 400 });
    const p = worldToCss(cam, view, 10, 20);
    expect(p.x - 200).toBeCloseTo(10);
    expect(p.y - 400).toBeCloseTo(20);
  });

  it("shakes for its duration only, and a stronger shake wins", () => {
    const view = computeViewport(400, 800, 1, 1, 400);
    const cam = createCamera();
    startShake(cam, 1, { durationS: 0.2, intensity: 0.01 });
    startShake(cam, 1.05, { durationS: 0.1, intensity: 0.001 });
    const rng = createRng(1);
    const s = shakeOffset(cam, view, 1.1, rng);
    expect(Math.abs(s.x) + Math.abs(s.y)).toBeGreaterThan(0);
    expect(shakeOffset(cam, view, 1.2, rng)).toEqual({ x: 0, y: 0 });
  });

  it("leads toward the move direction on sim time, and not at all when lead is 0", () => {
    const cam = createCamera();
    updateLead(cam, 1, 1, 0, 24, 0.3);
    expect(cam.leadX).toBe(0);
    updateLead(cam, 1.3, 1, 0, 24, 0.3);
    expect(cam.leadX).toBeCloseTo(24 * (1 - Math.exp(-1)));
    updateLead(cam, 1.3, 1, 0, 24, 0.3);
    expect(cam.leadX).toBeCloseTo(24 * (1 - Math.exp(-1)));
    updateLead(cam, 10, 0, -1, 24, 0.3);
    expect(cam.leadX).toBeCloseTo(0, 3);
    expect(cam.leadY).toBeCloseTo(-24, 3);
    const off = createCamera();
    updateLead(off, 0, 1, 1, 0, 0.3);
    updateLead(off, 5, 1, 1, 0, 0.3);
    expect([off.leadX, off.leadY]).toEqual([0, 0]);
  });
});
