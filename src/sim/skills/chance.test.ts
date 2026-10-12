import { describe, expect, it } from "vitest";
import { quietZap } from "@/test/content";
import { castAt, run, testWorld } from "@/test/world";

const CASTS = 2000;

/** A quick short bolt whose end sets off a "blast" burst with `chance` (omitted: always). */
function lucky(chance?: number) {
  const tier = {
    loadout: { auto: { skill: "zap" }, cast: { skill: "pop", modifiers: ["lucky"] } },
  };
  return {
    ...quietZap,
    // Long enough for every cast: the wave would end first and stop the sim.
    "threats/tier-1.json": { durationS: 1000, maxAlive: 100, spawns: [] },
    "builds/hero.json": { character: "hero", tiers: [tier, tier, tier] },
    "skills/pop.json": {
      tags: ["spell", "projectile", "area", "fire"],
      activation: "manual",
      target: "aim",
      stats: {
        damage: { fire: 1 },
        cooldown: 0.05,
        range: 4,
        area: 10,
        projectileSpeed: 120,
        projectileCount: 1,
        spread: 0,
        knockback: 0,
      },
      deliver: { do: "projectile", multishot: "fan", impact: "trigger", radius: 2, vfx: "zap" },
    },
    "modifiers/lucky.json": {
      attach: [
        {
          to: "projectile",
          hook: "onEnd",
          action: { do: "burst", shape: { kind: "circle" }, vfx: "blast" },
          ...(chance === undefined ? {} : { chance }),
        },
      ],
    },
  };
}

/** Per cast, in order: whether its bolt's end set off the attached burst. */
function procs(chance: number | undefined, seed: number): boolean[] {
  const w = testWorld(lucky(chance), { seed });
  const out: boolean[] = [];
  for (let i = 0; i < CASTS; i++) {
    // 3 ticks per cast (the cooldown); the bolt ends on the 2nd, its burst starts on the 3rd.
    const events = [...run(w, 1, castAt(1, 0)), ...run(w, 3)];
    out.push(events.some((e) => e.t === "volumeStarted" && e.vfx === "blast"));
  }
  return out;
}

const rate = (xs: boolean[]) => xs.filter(Boolean).length / xs.length;

describe("attach chance", () => {
  it("runs the attached action at about its chance each time the hook fires", () => {
    expect(rate(procs(0.25, 1))).toBeGreaterThan(0.21);
    expect(rate(procs(0.25, 1))).toBeLessThan(0.29);
  });

  it("always runs an attach without a chance", () => {
    expect(rate(procs(undefined, 1))).toBe(1);
  });

  it("rolls the same for the same seed and differently for another", () => {
    expect(procs(0.25, 5)).toEqual(procs(0.25, 5));
    expect(procs(0.25, 5)).not.toEqual(procs(0.25, 6));
  });
});
