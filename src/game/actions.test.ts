import { describe, expect, it } from "vitest";
import { actionCommand } from "@/game/actions";

describe("actionCommand", () => {
  it("reads frames, a move and a cast", () => {
    expect(actionCommand({ frames: 30, move: [1, 0], cast: [0, -1] })).toEqual({
      frames: 30,
      command: { moveX: 1, moveY: 0, cast: { slot: "cast", aim: { x: 0, y: -1 } } },
    });
    expect(actionCommand({ frames: 1, cast: "auto" }).command).toEqual({
      moveX: 0,
      moveY: 0,
      cast: { slot: "cast", aim: "auto" },
    });
  });

  it("refuses anything else", () => {
    expect(() => actionCommand({ frames: 0 })).toThrow(/frames/);
    expect(() => actionCommand({ frames: 5, move: [2, 0] })).toThrow(/move/);
    expect(() => actionCommand({ frames: 5, jump: true })).toThrow(/jump/);
    expect(() => actionCommand("cast")).toThrow(/action "cast"/);
  });
});
