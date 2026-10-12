import { describe, expect, it } from "vitest";
import { keysToMove } from "@/input/keyboard";

describe("keysToMove", () => {
  it("maps WASD and arrows, with +y down", () => {
    expect(keysToMove(new Set(["KeyW"]))).toEqual({ x: 0, y: -1 });
    expect(keysToMove(new Set(["ArrowRight"]))).toEqual({ x: 1, y: 0 });
  });

  it("normalises diagonals and cancels opposites", () => {
    const d = keysToMove(new Set(["KeyD", "KeyS"]));
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1);
    expect(keysToMove(new Set(["KeyA", "KeyD"]))).toEqual({ x: 0, y: 0 });
  });
});
