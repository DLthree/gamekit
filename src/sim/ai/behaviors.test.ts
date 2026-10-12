import { describe, expect, it } from "vitest";
import { keepDistance } from "@/sim/ai/behaviors";
import { playerOf } from "@/sim/world";
import { ROLE_A } from "@/test/vocab";
import { place, run, testWorld } from "@/test/world";

describe("keepDistance", () => {
  it("approaches from afar, backs off when close, rests in the band", () => {
    const w = testWorld();
    const player = playerOf(w);
    const a = place(w, "dummy", 500, 0);

    keepDistance(a, player, 100);
    expect(a.moveX).toBeCloseTo(-1, 5);
    expect(a.moveY).toBe(0);

    a.x = 50;
    keepDistance(a, player, 100);
    expect(a.moveX).toBeCloseTo(1, 5);
    expect(a.moveY).toBeCloseTo(0, 5);

    a.x = 100;
    keepDistance(a, player, 100);
    expect(a.moveX).toBe(0);
    expect(a.moveY).toBe(0);
  });

  it("backing into a wall slides along it without leaving the arena", () => {
    const w = testWorld({
      "enemies/dummy.json": {
        role: ROLE_A,
        stats: { life: 10, moveSpeed: 200, radius: 10, knockbackResist: 0 },
        behavior: { kind: "keepDistance", distance: 15 },
        skills: ["nibble"],
        look: "dummy",
      },
    });
    const arena = w.content.rules.arena;
    const a = place(w, "dummy", arena.halfWidth - 20, 0);
    run(w, 300, { moveX: 1, moveY: 1, cast: null });
    expect(a.x).toBeLessThanOrEqual(arena.halfWidth - a.radius);
    expect(a.x).toBeGreaterThanOrEqual(-arena.halfWidth + a.radius);
    expect(Math.abs(a.y)).toBeLessThanOrEqual(arena.halfHeight - a.radius);
    expect(a.y).not.toBe(0);
  });
});
