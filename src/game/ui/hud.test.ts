import { describe, expect, it } from "vitest";
import { hudModel } from "@/game/ui/hud";
import { run, testWorld } from "@/test/world";

describe("hudModel", () => {
  it("shows life, whole seconds left and kills while playing", () => {
    const w = testWorld();
    run(w, 90);
    expect(hudModel(w)).toEqual({ hp: 100, maxHp: 100, secondsLeft: 9, kills: 0, countdown: null });
  });

  it("counts down before the wave", () => {
    const w = testWorld({ "rules/feel.json": { hitStopS: 0, countdownS: 2 } });
    run(w, 30);
    expect(hudModel(w).countdown).toBe(2);
    run(w, 60);
    expect(hudModel(w).countdown).toBe(1);
  });
});
