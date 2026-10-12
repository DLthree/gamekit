import { describe, expect, it } from "vitest";
import { clampLength, rotate, unit } from "@/core/vec";

describe("vec", () => {
  it("unit scales to length 1", () => {
    const u = unit(3, 4, { x: 1, y: 0 });
    expect(u.x).toBeCloseTo(0.6);
    expect(u.y).toBeCloseTo(0.8);
  });

  it("unit of a zero vector is the named fallback, never NaN", () => {
    expect(unit(0, 0, { x: -1, y: 0 })).toEqual({ x: -1, y: 0 });
  });

  it("clampLength keeps short vectors and shortens long ones", () => {
    expect(clampLength(0.3, 0.4, 1)).toEqual({ x: 0.3, y: 0.4 });
    const c = clampLength(1, 1, 1);
    expect(Math.hypot(c.x, c.y)).toBeCloseTo(1);
  });

  it("rotate turns +x toward +y (clockwise on screen) for a positive angle", () => {
    const r = rotate(1, 0, Math.PI / 2);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(1);
  });
});
