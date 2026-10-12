import { describe, expect, it } from "vitest";
import type { SimEvent } from "@/sim/events";
import type { World } from "@/sim/world";
import { quietZap } from "@/test/content";
import { DMG_A, ROLE_A, TAG_B, TAG_C } from "@/test/vocab";
import { enemies, place, run, runUntilEvent, testWorld } from "@/test/world";

/**
 * A "caster" enemy at (x, 0) whose only skill is `charge`: an auto lane burst on the player,
 * warn 0.5s, range 200, duration 0.25 (for the onEnd dash), area 10, once per 10 s.
 */
function worldWithCharge(
  nodeExtra: Record<string, unknown>,
  { x = 100, moveSpeed = 0 }: { x?: number; moveSpeed?: number } = {},
): World {
  const w = testWorld({
    ...quietZap,
    "skills/charge.json": {
      tags: [TAG_C, TAG_B, DMG_A],
      activation: "auto",
      target: "player",
      stats: {
        damage: { [DMG_A]: 5 },
        rate: 0.1,
        range: 200,
        area: 10,
        knockback: 0,
        duration: 0.25,
      },
      deliver: {
        do: "burst",
        vfx: "mark",
        shape: { kind: "lane" },
        warn: 0.5,
        onEnd: [{ do: "dash" }],
        ...nodeExtra,
      },
    },
    "enemies/caster.json": {
      role: ROLE_A,
      stats: { life: 100, moveSpeed, radius: 10, knockbackResist: 0 },
      behavior: { kind: "chase" },
      skills: ["charge"],
      look: "dummy",
    },
  });
  place(w, "caster", x, 0);
  return w;
}

function only<T extends SimEvent["t"]>(events: SimEvent[], t: T): Extract<SimEvent, { t: T }>[] {
  return events.filter((e): e is Extract<SimEvent, { t: T }> => e.t === t);
}

describe("dash", () => {
  it("a lane telegraph's onEnd dash carries its owner the lane's length over duration", () => {
    const w = worldWithCharge({});
    const caster = enemies(w)[0];
    const x0 = caster.x;
    runUntilEvent(w, "telegraphResolved");
    run(w, 15);
    // dirX toward the player at the origin from (100, 0) is -1: range 200 carries it to -100.
    expect(caster.x).toBeCloseTo(x0 - 200, 5);
  });

  it("a dash whose owner died before it started does nothing", () => {
    const w = worldWithCharge({});
    const caster = enemies(w)[0];
    runUntilEvent(w, "telegraphResolved");
    const x0 = caster.x;
    caster.hp = 0;
    expect(() => run(w, 5)).not.toThrow();
    expect(caster.x).toBe(x0);
  });

  it("a dash never reaches a new actor in the owner's reused slot", () => {
    const w = worldWithCharge({});
    const caster = enemies(w)[0];
    runUntilEvent(w, "volumeStarted");
    run(w, 29);
    caster.hp = 0;
    const events = run(w, 1);
    expect(only(events, "telegraphResolved")).toHaveLength(1);
    expect(w.actors.alive).toBe(1);
    const fresh = place(w, "dummy", 50, 50);
    const freshX = fresh.x;
    const freshY = fresh.y;
    run(w, 20);
    expect(fresh.x).toBe(freshX);
    expect(fresh.y).toBe(freshY);
  });

  it("dashing skips separation and still stops at the arena wall", () => {
    const w = testWorld();
    const { arena, movement } = w.content.rules;
    expect(movement.separationRadius).toBeGreaterThan(0);
    const a = place(w, "dummy", arena.halfWidth - 50, 0);
    place(w, "dummy", arena.halfWidth - 45, 5);
    a.dashTicks = 30;
    a.dashVX = 1000;
    a.dashVY = 0;
    const y0 = a.y;
    run(w, 30);
    expect(a.x).toBe(arena.halfWidth - a.radius);
    expect(a.y).toBe(y0);
  });
});
