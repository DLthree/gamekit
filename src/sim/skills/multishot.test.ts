import { describe, expect, it } from "vitest";
import type { Multishot } from "@/content/schema/skill";
import { heroBuild } from "@/game/test-files";
import type { SimEvent } from "@/sim/events";
import { quietZap } from "@/test/content";
import { DMG_A, ROLE_A, TAG_A } from "@/test/vocab";
import { castAt, place, run, testWorld } from "@/test/world";

/** A manual multishot bolt; dummies that never move or bite back at these distances. */
function shot(multishot: Multishot, projectileCount: number, spread = 0) {
  return {
    ...quietZap,
    ...heroBuild("zap", "shot"),
    "skills/shot.json": {
      tags: [TAG_A, DMG_A],
      activation: "manual",
      target: "aim",
      stats: {
        damage: { [DMG_A]: 1 },
        cooldown: 5,
        range: 200,
        projectileSpeed: 120,
        projectileCount,
        spread,
        knockback: 0,
      },
      deliver: { do: "projectile", multishot, impact: "damage", radius: 4, vfx: "zap" },
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

/** The angle (degrees, rounded) of every projectile the cast toward (1, 0) launched. */
function angles(patch: Record<string, unknown>, enemies: [number, number][] = [], seed = 1) {
  const w = testWorld(patch, { seed });
  for (const [x, y] of enemies) place(w, "dummy", x, y);
  run(w, 1); // index the enemies, as every tick after the first finds them
  const events = run(w, 2, castAt(1, 0));
  return events
    .filter(
      (e): e is Extract<SimEvent, { t: "volumeStarted" }> =>
        e.t === "volumeStarted" && e.kind === "projectile",
    )
    .map((e) => Math.round((Math.atan2(e.dirY, e.dirX) * 180) / Math.PI));
}

describe("projectile multishot patterns", () => {
  it("fan spreads the projectiles over `spread` around the targeted direction", () => {
    expect(angles(shot("fan", 3, 20), [[0, 100]])).toEqual([-10, 0, 10]);
  });

  it("nearest sends each projectile at a distinct enemy, nearest first", () => {
    const far = [150, 0] as [number, number];
    expect(angles(shot("nearest", 2), [far, [0, 50], [-80, 0]])).toEqual([90, 180]);
  });

  it("nearest cycles through the found enemies when there are fewer than projectiles", () => {
    expect(
      angles(shot("nearest", 5), [
        [0, 50],
        [-80, 0],
      ]),
    ).toEqual([90, 180, 90, 180, 90]);
  });

  it("nearest with no enemy in range fans along the targeted direction", () => {
    expect(angles(shot("nearest", 3, 20), [[500, 0]])).toEqual([-10, 0, 10]);
  });

  it("nova spaces the projectiles evenly around 360° from the targeted direction", () => {
    expect(angles(shot("nova", 4, 20))).toEqual([0, 90, 180, -90]);
  });

  it("scatter sends each projectile in a random direction, the same for the same seed", () => {
    const a = angles(shot("scatter", 6), [], 3);
    expect(angles(shot("scatter", 6), [], 3)).toEqual(a);
    expect(angles(shot("scatter", 6), [], 4)).not.toEqual(a);
    expect(new Set(a).size).toBe(6);
  });
});
