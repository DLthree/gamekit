import { describe, expect, it } from "vitest";
import { heroBuild } from "@/game/test-files";
import type { SimEvent } from "@/sim/events";
import { quietZap } from "@/test/content";
import { DMG_A, ROLE_A, TAG_A, TAG_B } from "@/test/vocab";
import { castAt, place, run, testWorld } from "@/test/world";

/** A manual skill that drops a zone at the caster: 4 damage per pulse, 4 pulses, radius 30. */
function pool(node: Record<string, unknown> = {}) {
  return {
    ...quietZap,
    ...heroBuild("zap", "pool"),
    "skills/pool.json": {
      tags: [TAG_A, TAG_B, DMG_A],
      activation: "manual",
      target: "aim",
      stats: {
        damage: { [DMG_A]: 4 },
        cooldown: 0.5,
        range: 100,
        area: 30,
        duration: 1,
        pulse: 0.25,
        knockback: 0,
      },
      deliver: { do: "zone", motion: "static", vfx: "none", ...node },
    },
    "enemies/dummy.json": {
      role: ROLE_A,
      stats: { life: 1000, moveSpeed: 0, radius: 10, knockbackResist: 0 },
      behavior: { kind: "chase" },
      skills: ["nibble"],
      look: "dummy",
    },
  };
}

function hitsOn(events: SimEvent[], id: number) {
  return events.filter(
    (e): e is Extract<SimEvent, { t: "hit" }> => e.t === "hit" && e.target === id,
  );
}

describe("zone", () => {
  it("pulses from its first tick every pulse seconds for its duration, then ends", () => {
    const w = testWorld(pool());
    const d = place(w, "dummy", 35, 0);
    const events = [...run(w, 1, castAt(1, 0)), ...run(w, 80)];
    const started = events.find((e) => e.t === "volumeStarted" && e.kind === "zone");
    expect(started).toMatchObject({ tick: 1, lifeTicks: 60, r: 30 });
    const hits = hitsOn(events, d.id);
    expect(hits.map((e) => e.tick)).toEqual([2, 17, 32, 47]);
    expect(hits.map((e) => e.amount)).toEqual([4, 4, 4, 4]);
    expect(hits.every((e) => e.kx === 0 && e.ky === 0)).toBe(true);
    const ended = events.find((e) => e.t === "volumeEnded" && e.kind === "zone");
    expect(ended?.tick).toBe(61);
  });

  it("scales its radius and damage by the node's scales", () => {
    const w = testWorld(pool({ areaScale: 0.5, damageScale: 0.5 }));
    const far = place(w, "dummy", 35, 0);
    const near = place(w, "dummy", -20, 0);
    const events = [...run(w, 1, castAt(1, 0)), ...run(w, 5)];
    expect(hitsOn(events, far.id)).toEqual([]);
    expect(hitsOn(events, near.id).map((e) => e.amount)).toEqual([2]);
  });

  it("stacks: two patches pulse on their own clocks", () => {
    const w = testWorld(pool());
    const d = place(w, "dummy", 35, 0);
    const events = [...run(w, 40, castAt(1, 0)), ...run(w, 80)];
    expect(
      events.filter((e) => e.t === "volumeStarted" && e.kind === "zone").map((e) => e.tick),
    ).toEqual([1, 31]);
    const ticks = hitsOn(events, d.id).map((e) => e.tick);
    expect(ticks).toEqual([2, 17, 32, 32, 47, 47, 62, 77]);
    expect(w.volumes.alive).toBe(0);
  });

  it("delivers its onEnd child at its position on the tick after it ends", () => {
    const w = testWorld(pool({ onEnd: [{ do: "burst", shape: { kind: "circle" }, vfx: "none" }] }));
    const d = place(w, "dummy", 35, 0);
    const events = [...run(w, 1, castAt(1, 0)), ...run(w, 80)];
    const ended = events.find((e) => e.t === "volumeEnded" && e.kind === "zone");
    expect(ended).toMatchObject({ tick: 61, x: 0, y: 0 });
    const child = events.find(
      (e) => e.t === "volumeStarted" && e.kind === "burst" && e.ownerDef === "hero",
    );
    expect(child).toMatchObject({ tick: 62, x: 0, y: 0 });
    // The child volume joins the world in tick 62's spawn phase, so its own sweep is tick 63's.
    expect(hitsOn(events, d.id).find((e) => e.tick === 63)?.amount).toBe(4);
  });
});
