import { describe, expect, it } from "vitest";
import type { SimEvent } from "@/sim/events";
import { playerOf } from "@/sim/world";
import { heroBuild, quietZap } from "@/test/content";
import { castAt, place, run, testWorld } from "@/test/world";

function boom(patch: { hitStop?: boolean } = {}) {
  return {
    "skills/boom.json": {
      tags: ["spell", "projectile", "area", "fire"],
      activation: "manual",
      target: "aim",
      stats: {
        damage: { fire: 10 },
        cooldown: 1,
        range: 300,
        area: 50,
        projectileSpeed: 600,
        projectileCount: 1,
        spread: 0,
        knockback: 200,
      },
      deliver: {
        do: "projectile",
        multishot: "fan",
        impact: "trigger",
        radius: 6,
        vfx: "boom",
        onEnd: [
          { do: "burst", shape: { kind: "circle" }, vfx: "blast", hitStop: patch.hitStop ?? false },
        ],
      },
    },
  };
}

/** Two co-located projectiles: lets a test land two hits on the same target the same tick. */
function twin() {
  return {
    "skills/twin.json": {
      tags: ["spell", "projectile", "fire"],
      activation: "manual",
      target: "aim",
      stats: {
        damage: { fire: 10 },
        cooldown: 1,
        range: 300,
        projectileSpeed: 600,
        projectileCount: 2,
        spread: 0,
        knockback: 0,
      },
      deliver: { do: "projectile", multishot: "fan", impact: "damage", radius: 6, vfx: "zap" },
    },
  };
}

/** A fast, short-range bolt: its per-tick step (20) is bigger than any contact reach (14), so
 *  contact and hitting max range coincide on the exact same tick — Review Focus for issue 3. */
function spike() {
  return {
    "skills/spike.json": {
      tags: ["spell", "projectile", "fire"],
      activation: "manual",
      target: "aim",
      stats: {
        damage: { fire: 7 },
        cooldown: 1,
        range: 100,
        projectileSpeed: 1200,
        projectileCount: 1,
        spread: 0,
        knockback: 0,
      },
      deliver: { do: "projectile", multishot: "fan", impact: "damage", radius: 4, vfx: "zap" },
    },
  };
}

const quickCast = { moveX: 0, moveY: 0, cast: { slot: "cast" as const, aim: "auto" as const } };

function only<T extends SimEvent["t"]>(events: SimEvent[], t: T): Extract<SimEvent, { t: T }>[] {
  return events.filter((e): e is Extract<SimEvent, { t: T }> => e.t === t);
}

describe("auto skills", () => {
  it("fire at the nearest enemy in range and hit it", () => {
    const w = testWorld();
    const d = place(w, "dummy", 100, 0);
    const events = run(w, 30);
    const cast = only(events, "cast").find((e) => e.skill === "zap");
    expect(cast?.ax).toBeCloseTo(1);
    const hit = only(events, "hit").find((e) => e.target === d.id);
    expect(hit?.amount).toBe(5);
    expect(hit?.skill).toBe("zap");
  });

  it("with no target in range, don't fire or start the cooldown", () => {
    const w = testWorld();
    place(w, "dummy", 300, 0);
    const events = run(w, 10);
    expect(only(events, "cast")).toEqual([]);
    expect(playerOf(w).skills[0].readyTick).toBe(0);
  });

  it("an enemy bites the player within reach", () => {
    const w = testWorld(quietZap);
    place(w, "dummy", 28, 0);
    const events = run(w, 3);
    expect(only(events, "playerHurt")[0]).toMatchObject({ amount: 3, hp: 97, by: "dummy" });
  });
});

describe("the cast skill", () => {
  it("explodes on first contact and its burst hits every body within its area, once", () => {
    const w = testWorld({ ...quietZap, ...boom() });
    const first = place(w, "dummy", 200, 0);
    const inside = place(w, "dummy", 190, 59);
    const outside = place(w, "dummy", 190, -61);
    const events = [...run(w, 1, castAt(1, 0)), ...run(w, 40)];
    const hits = only(events, "hit");
    expect(hits.map((h) => h.target).sort()).toEqual([first.id, inside.id].sort());
    expect(hits.every((h) => h.amount === 10 && h.skill === "boom")).toBe(true);
    expect(outside.hp).toBe(10);
    const push = hits.find((h) => h.target === inside.id);
    expect(push?.ky).toBeGreaterThan(0);
    const died = only(events, "died");
    expect(died).toHaveLength(2);
    expect(died[0]).toMatchObject({ killer: "hero", skill: "boom", role: "fodder" });
  });

  it("ends at its range with no contact and bursts there", () => {
    const w = testWorld({ ...quietZap, ...boom() });
    const events = [...run(w, 1, castAt(1, 0)), ...run(w, 40)];
    const ended = only(events, "volumeEnded").find((e) => e.kind === "projectile");
    expect(ended?.x).toBeCloseTo(300);
    const burst = only(events, "volumeStarted").find((e) => e.kind === "burst");
    expect(burst).toMatchObject({ vfx: "blast", r: 50 });
    expect(burst?.x).toBeCloseTo(300);
  });

  it("freezes the world on a hit-stop burst", () => {
    const w = testWorld({
      ...quietZap,
      ...boom({ hitStop: true }),
      "rules/feel.json": { hitStopS: 0.05, countdownS: 0 },
    });
    place(w, "dummy", 100, 0);
    run(w, 1, castAt(1, 0));
    for (let i = 0; i < 40 && w.freezeTicks === 0; i++) run(w, 1);
    expect(w.freezeTicks).toBe(3);
  });

  it("drops a cast made during the cooldown", () => {
    const w = testWorld({ ...quietZap, ...boom() });
    const events = [
      ...run(w, 1, castAt(1, 0)),
      ...run(w, 10),
      ...run(w, 1, castAt(0, 1)),
      ...run(w, 60),
    ];
    expect(only(events, "cast").filter((e) => e.skill === "boom")).toHaveLength(1);
  });
});

describe("volume hits", () => {
  it("throws instead of silently dropping a hit when the hit buffer overflows", () => {
    const w = testWorld({
      ...quietZap,
      ...twin(),
      ...heroBuild("zap", "twin"),
      "rules/limits.json": {
        actors: 256,
        volumes: 256,
        events: 1024,
        hits: 1,
        hashCellSize: 32,
      },
    });
    place(w, "dummy", 200, 0);
    expect(() => {
      run(w, 1, castAt(1, 0));
      run(w, 40);
    }).toThrow(/tick \d+.*hits/);
  });

  it("kills a target only once when two lethal hits land on it the same tick", () => {
    const w = testWorld({ ...quietZap, ...twin(), ...heroBuild("zap", "twin") });
    const d = place(w, "dummy", 200, 0);
    const events = [...run(w, 1, castAt(1, 0)), ...run(w, 40)];
    expect(only(events, "died").filter((e) => e.id === d.id)).toHaveLength(1);
    expect(d.hp).toBe(0);
  });

  it("hits an enemy sitting exactly at a projectile's range end", () => {
    const w = testWorld({ ...quietZap, ...spike(), ...heroBuild("zap", "spike") });
    const d = place(w, "dummy", 100, 0);
    const events = [...run(w, 1, castAt(1, 0)), ...run(w, 10)];
    const hit = only(events, "hit").find((e) => e.target === d.id);
    expect(hit?.amount).toBe(7);
    expect(hit?.skill).toBe("spike");
  });
});

describe("quick-cast and zero aim (Review Focus 5)", () => {
  function projectileStart(events: SimEvent[]) {
    const v = only(events, "volumeStarted").find((e) => e.kind === "projectile");
    if (v === undefined) throw new Error("no projectile");
    return v;
  }

  it("a quick-cast with no enemy alive goes along the facing", () => {
    const w = testWorld({ ...quietZap, ...boom() });
    run(w, 3, { moveX: -1, moveY: 0, cast: null });
    const events = [...run(w, 1, quickCast), ...run(w, 5)];
    const cast = only(events, "cast")[0];
    expect([cast.ax, cast.ay]).toEqual([-1, 0]);
    const v = projectileStart(events);
    expect([v.dirX, v.dirY]).toEqual([-1, 0]);
    for (const e of events) if ("x" in e) expect(Number.isFinite(e.x)).toBe(true);
  });

  it("a zero-length aim goes along the facing", () => {
    const w = testWorld({ ...quietZap, ...boom() });
    const events = [...run(w, 1, castAt(0, 0)), ...run(w, 5)];
    expect(projectileStart(events).dirX).toBe(1);
    expect(Number.isNaN(projectileStart(events).dirY)).toBe(false);
  });

  it("a quick-cast with an enemy in range aims at the nearest one", () => {
    const w = testWorld({ ...quietZap, ...boom() });
    place(w, "dummy", 0, 150);
    run(w, 1);
    const events = run(w, 1, quickCast);
    const cast = only(events, "cast")[0];
    expect(cast.ax).toBeCloseTo(0);
    expect(cast.ay).toBeCloseTo(1);
  });
});
