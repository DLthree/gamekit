import { describe, expect, it } from "vitest";
import { indexActors } from "@/realtime/sim/actors/movement";
import { nearestEnemy, playerGap } from "@/realtime/sim/combat/targeting";
import { playerOf } from "@/realtime/sim/world";
import { place, testWorld } from "@/realtime/test/world";

describe("targeting", () => {
  it("finds the nearest living enemy within range", () => {
    const w = testWorld();
    const far = place(w, "dummy", 150, 0);
    const near = place(w, "dummy", -100, 0);
    indexActors(w);
    expect(nearestEnemy(w, 0, 0, 200)).toBe(near);
    near.hp = 0;
    expect(nearestEnemy(w, 0, 0, 200)).toBe(far);
    expect(nearestEnemy(w, 0, 0, 120)).toBeNull();
  });

  it("measures the gap between two bodies' edges", () => {
    const w = testWorld();
    const e = place(w, "dummy", 50, 0);
    expect(playerGap(e, playerOf(w))).toBe(30);
  });
});
