import { describe, expect, it } from "vitest";
import { type SweepRow, sweepTable } from "@/game/sweep";

const row = (over: Partial<SweepRow>): SweepRow => ({
  run: "wizard-b1-t1",
  seed: 1,
  outcome: "survived",
  secs: 60,
  kills: 10,
  lifeLost: 50,
  killer: null,
  ...over,
});

describe("sweepTable", () => {
  it("summarises each run: win rate, medians and the commonest killer", () => {
    const t = sweepTable([
      row({ seed: 1 }),
      row({ seed: 2, outcome: "died", secs: 30, kills: 4, lifeLost: 100, killer: "bat" }),
      row({ seed: 3, outcome: "died", secs: 40, kills: 6, lifeLost: 100, killer: "bat" }),
    ]);
    expect(t["wizard-b1-t1"]).toEqual({
      win: "33%",
      n: "3",
      secs: "40",
      kills: "6",
      lifeLost: "100%",
      killer: "bat ×2",
    });
  });
});
