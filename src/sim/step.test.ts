import { describe, expect, it } from "vitest";
import { ticks } from "@/core/clock";
import { OUTCOMES } from "@/game/vocab";
import { IDLE } from "@/sim/command";
import { queueEnemy } from "@/sim/spawn-queue";
import { step } from "@/sim/step";
import { enemies, run, runUntilEvent, testWorld } from "@/test/world";

describe("step", () => {
  it("counts down before the wave plays", () => {
    const w = testWorld({ "rules/feel.json": { hitStopS: 0, countdownS: 0.5 } });
    run(w, ticks(0.5) - 1);
    expect(w.phase).toBe("countdown");
    run(w, 1);
    expect(w.phase).toBe("playing");
    expect(w.wave.elapsed).toBe(0);
  });

  it("ends once with one of the game's outcomes, then stops stepping", () => {
    const w = testWorld();
    const end = runUntilEvent(w, "waveEnded", ticks(600));
    expect(OUTCOMES).toContain(end.outcome);
    expect(w.outcome).toBe(end.outcome);
    expect(w.report.outcome).toBe(end.outcome);
    const tick = w.tick;
    expect(run(w, 5)).toEqual([]);
    expect(w.tick).toBe(tick);
  });

  it("does not advance the tick or the wave timer while frozen by hit-stop, and counts the steps", () => {
    const w = testWorld();
    run(w, 10);
    w.freezeTicks = 3;
    run(w, 3);
    expect(w.tick).toBe(10);
    expect(w.wave.elapsed).toBe(10);
    expect(w.frozenSteps).toBe(3);
    run(w, 1);
    expect(w.tick).toBe(11);
  });

  it("caps enemies at the threat's maxAlive and counts the dropped spawns", () => {
    const w = testWorld({ "threats/tier-1.json": { durationS: 10, maxAlive: 3, spawns: [] } });
    for (let i = 0; i < 5; i++) queueEnemy(w, "dummy", 100 + i * 30, 0);
    step(w, IDLE);
    expect(enemies(w)).toHaveLength(3);
    expect(w.events.items.filter((e) => e.t === "spawned")).toHaveLength(3);
    expect(w.report.droppedSpawns).toBe(2);
    expect(w.report.spawned).toBe(3);
    expect(w.report.peakAlive).toBe(3);
  });
});
