import { describe, expect, it } from "vitest";
import { heroBuild } from "@/game/test-files";
import type { SimEvent } from "@/sim/events";
import { quietZap } from "@/test/content";
import { castAt, place, run, testWorld } from "@/test/world";

/** A manual bolt (2 units a tick by default) that pierces `pierce` bodies. */
function lance(pierce: number | null, projectileSpeed = 120) {
  const stats: Record<string, unknown> = {
    damage: { fire: 5 },
    cooldown: 5,
    range: 300,
    projectileSpeed,
    projectileCount: 1,
    spread: 0,
    knockback: 0,
  };
  if (pierce !== null) stats.pierce = pierce;
  return {
    ...quietZap,
    ...heroBuild("zap", "lance"),
    "skills/lance.json": {
      tags: ["spell", "projectile", "fire"],
      activation: "manual",
      target: "aim",
      stats,
      deliver: { do: "projectile", multishot: "fan", impact: "damage", radius: 4, vfx: "zap" },
    },
    // Enemy schema requires at least one skill; nibble's range (20) is far short of the
    // distances used here, so the dummies never land a hit back.
    "enemies/dummy.json": {
      role: "fodder",
      stats: { life: 1000, moveSpeed: 0, radius: 10, knockbackResist: 0 },
      behavior: { kind: "chase" },
      skills: ["nibble"],
      look: "dummy",
    },
  };
}

const hits = (events: SimEvent[]) =>
  events.filter((e): e is Extract<SimEvent, { t: "hit" }> => e.t === "hit");

describe("pierce", () => {
  it("without pierce, a projectile ends on its first body", () => {
    const w = testWorld(lance(null));
    const a = place(w, "dummy", 60, 0);
    place(w, "dummy", 100, 0);
    const events = [...run(w, 1, castAt(1, 0)), ...run(w, 120)];
    expect(hits(events).map((e) => e.target)).toEqual([a.id]);
  });

  it("with pierce 2, hits three bodies in a line once each, then ends", () => {
    const w = testWorld(lance(2));
    const ids = [60, 100, 140, 180].map((x) => place(w, "dummy", x, 0).id);
    const events = [...run(w, 1, castAt(1, 0)), ...run(w, 150)];
    expect(hits(events).map((e) => e.target)).toEqual(ids.slice(0, 3));
    expect(events.filter((e) => e.t === "volumeEnded").length).toBe(1);
  });

  it("takes the nearest contact first when several touch in one tick", () => {
    // 10 units a tick: at x = 60 both bodies are in reach (4 + 10) for the first time.
    const w = testWorld(lance(0, 600));
    const far = place(w, "dummy", 60, -13.5);
    const near = place(w, "dummy", 60, 12);
    const events = [...run(w, 1, castAt(1, 0)), ...run(w, 30)];
    expect(hits(events).map((e) => e.target)).toEqual([near.id]);
    expect(far.hp).toBe(1000);
  });
});
