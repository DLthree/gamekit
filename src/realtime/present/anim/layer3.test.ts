import { describe, expect, it } from "vitest";
import { bodyToWorld, newPropPose, propRest, staffThrust } from "@/realtime/present/anim/layer3";

const DEG = Math.PI / 180;

describe("layer 3 props", () => {
  it("sways a held prop a few degrees around its rest angle", () => {
    for (const t of [0, 0.4, 1.2, 3]) {
      const a = propRest(12, t, newPropPose()).angle / DEG;
      expect(Math.abs(a - 12)).toBeLessThanOrEqual(3);
    }
  });

  it("thrusts: back and away, a forward jab at the release, held, then home", () => {
    const start = staffThrust(0, 12, 48, newPropPose());
    expect(start.angle).toBeCloseTo(12 * DEG);
    expect(start.dx).toBeCloseTo(0);
    expect(start.dy).toBeCloseTo(0);
    const back = staffThrust(0.35, 12, 48, newPropPose());
    expect(back.angle).toBeCloseTo(-13 * DEG);
    expect(back.dx).toBeCloseTo(-4.8);
    const jab = staffThrust(0.5, 12, 48, newPropPose());
    expect(jab.angle).toBeCloseTo(72 * DEG);
    expect(jab.dx).toBeCloseTo(0.28 * 48);
    expect(staffThrust(0.6, 12, 48, newPropPose()).angle).toBeCloseTo(72 * DEG);
    const home = staffThrust(1, 12, 48, newPropPose());
    expect(home.angle).toBeCloseTo(12 * DEG);
    expect(home.dx).toBeCloseTo(0);
  });

  it("places a local point the way the renderer places the body", () => {
    const body = { x: 100, y: 50, scaleX: -1, scaleY: 1, rot: 0 };
    expect(bodyToWorld(body, 10, -20, { x: 0, y: 0 })).toEqual({ x: 90, y: 30 });
    const turned = bodyToWorld({ ...body, scaleX: 1, rot: Math.PI / 2 }, 10, 0, { x: 0, y: 0 });
    expect(turned.x).toBeCloseTo(100);
    expect(turned.y).toBeCloseTo(60);
  });
});
