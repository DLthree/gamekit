import { describe, expect, it } from "vitest";
import { ticks } from "@/core/clock";
import { playerOf } from "@/sim/world";
import { ROLE_A } from "@/test/vocab";
import { enemies, run, TEST_SCENARIO, testWorld } from "@/test/world";

const bench = (over: Record<string, unknown> = {}) => ({
  "stages/bench.json": {
    name: "Bench",
    from: "char=hero&build=1&threat=1",
    durationS: 5,
    armed: false,
    hold: false,
    actors: [
      { enemy: "dummy", x: 80, y: 0, respawnS: 1 },
      { enemy: "dummy", x: -80, y: 0 },
    ],
    ...over,
  },
});

/** The test dummy, but walking. */
const walker = {
  "enemies/dummy.json": {
    role: ROLE_A,
    stats: { life: 10, moveSpeed: 60, radius: 10, knockbackResist: 0 },
    behavior: { kind: "chase" },
    skills: ["nibble"],
    look: "dummy",
  },
};

const onBench = (over: Record<string, unknown> = {}) =>
  testWorld({ ...walker, ...bench(over) }, { ...TEST_SCENARIO, stage: "bench" });

function kill(w: ReturnType<typeof testWorld>, x: number) {
  const a = enemies(w).find((e) => e.x === x);
  if (a === undefined) throw new Error(`no enemy at ${x}`);
  a.hp = 0;
  return a;
}

describe("a stage", () => {
  it("places its actors on the first tick, with no countdown", () => {
    const w = onBench();
    expect(w.phase).toBe("playing");
    run(w, 1);
    expect(enemies(w).map((e) => [e.def, e.x, e.y])).toEqual([
      ["dummy", 80, 0],
      ["dummy", -80, 0],
    ]);
  });

  it("brings a dead actor back at its place after respawnS, and one without it never", () => {
    const w = onBench({ hold: true });
    run(w, 1);
    kill(w, 80);
    kill(w, -80);
    run(w, ticks(1));
    expect(enemies(w)).toHaveLength(0);
    run(w, 2);
    expect(enemies(w).map((e) => [e.x, e.y])).toEqual([[80, 0]]);
  });

  it("holds its enemies in place when asked, and lets them walk when not", () => {
    const held = onBench({ hold: true });
    run(held, 60);
    expect(enemies(held).map((e) => e.x)).toEqual([80, -80]);
    const free = onBench();
    run(free, 60);
    expect(enemies(free).map((e) => Math.abs(e.x))).not.toEqual([80, 80]);
  });

  it("keeps the player at 1 life or more", () => {
    const w = onBench({ actors: [{ enemy: "dummy", x: 15, y: 0 }] });
    run(w, 1);
    playerOf(w).hp = 1;
    const events = run(w, ticks(5) + 5);
    expect(events.filter((e) => e.t === "playerHurt").length).toBeGreaterThan(0);
    expect(events.some((e) => e.t === "died" && e.role === "player")).toBe(false);
    expect(playerOf(w).hp).toBe(1);
  });

  it("leaves an unarmed player without skills", () => {
    expect(playerOf(onBench()).skills).toEqual([]);
    expect(playerOf(onBench({ armed: true })).skills.length).toBeGreaterThan(0);
  });
});
