import { describe, expect, it } from "vitest";
import {
  aimVector,
  isAiming,
  isCancelArmed,
  moveDrag,
  resolveRelease,
  type SkillDrag,
} from "@/realtime/input/gesture";

const R = 46;
const start: SkillDrag = { dx: 0, dy: 0, leftButton: false };

describe("skill button gestures", () => {
  it("a press that never leaves the button is a quick-cast", () => {
    const d = moveDrag(start, 10, -5, R);
    expect(isAiming(d, R)).toBe(false);
    expect(resolveRelease(d, R, { x: 1, y: 0 })).toEqual({ kind: "quick" });
  });

  it("dragging out aims, and releasing there casts along the aim", () => {
    const d = moveDrag(start, -120, -40, R);
    expect(isAiming(d, R)).toBe(true);
    expect(resolveRelease(d, R, { x: -3, y: 2 })).toEqual({ kind: "cast", aimX: -3, aimY: 2 });
  });

  it("dragging back onto the button arms a cancel", () => {
    const out = moveDrag(start, -120, 0, R);
    const back = moveDrag(out, 5, 5, R);
    expect(isCancelArmed(back, R)).toBe(true);
    expect(resolveRelease(back, R, { x: 1, y: 1 })).toEqual({ kind: "cancel" });
  });

  it("absolute aim runs from the player to the finger; relative from the button centre", () => {
    const finger = { x: 100, y: 300 };
    const button = { x: 330, y: 700 };
    const player = { x: 195, y: 420 };
    expect(aimVector("absolute", finger, button, player)).toEqual({ x: -95, y: -120 });
    expect(aimVector("relative", finger, button, player)).toEqual({ x: -230, y: -400 });
  });
});
