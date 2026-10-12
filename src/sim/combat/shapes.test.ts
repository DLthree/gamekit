import { describe, expect, it } from "vitest";
import { inArc, inCircle, inLane } from "@/sim/combat/shapes";

describe("shapes", () => {
  it("a circle hits a body whose edge it touches", () => {
    expect(inCircle(0, 0, 50, 59, 0, 10)).toBe(true);
    expect(inCircle(0, 0, 50, 61, 0, 10)).toBe(false);
  });

  it("an arc hits in front, not behind", () => {
    const half = (70 * Math.PI) / 180;
    expect(inArc(0, 0, 30, 1, 0, half, 25, 5, 5)).toBe(true);
    expect(inArc(0, 0, 30, 1, 0, half, -25, 0, 5)).toBe(false);
    expect(inArc(0, 0, 30, 1, 0, half, 0, 25, 5)).toBe(false);
  });

  it("an arc hits a body that overlaps its centre whatever the angle", () => {
    expect(inArc(0, 0, 30, 1, 0, 0.1, -3, 0, 5)).toBe(true);
  });

  it("a lane is a capsule from its start along its direction", () => {
    // From (0, 0) toward +x, 100 long, half-width 10; bodies of radius 5.
    const lane = (x: number, y: number) => inLane(0, 0, 1, 0, 100, 10, x, y, 5);
    expect(lane(50, 0)).toBe(true);
    expect(lane(50, 14)).toBe(true);
    expect(lane(50, 16)).toBe(false);
    expect(lane(-14, 0)).toBe(true);
    expect(lane(-10, 10)).toBe(true);
    expect(lane(-16, 0)).toBe(false);
    expect(lane(114, 0)).toBe(true);
    expect(lane(110, 10)).toBe(true);
    expect(lane(116, 0)).toBe(false);
  });

  it("a lane follows a diagonal direction", () => {
    const d = Math.SQRT1_2;
    expect(inLane(0, 0, d, d, 100, 10, 50, 50, 5)).toBe(true);
    expect(inLane(0, 0, d, d, 100, 10, 50, 0, 5)).toBe(false);
  });
});
