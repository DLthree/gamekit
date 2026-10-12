import { describe, expect, it } from "vitest";
import { playerOf } from "@/sim/world";
import { ROLE_A } from "@/test/vocab";
import { place, run, testWorld } from "@/test/world";

const chaser = {
  "enemies/dummy.json": {
    role: ROLE_A,
    stats: { life: 10, moveSpeed: 60, radius: 10, knockbackResist: 0 },
    behavior: { kind: "chase" },
    skills: ["nibble"],
    look: "dummy",
  },
};

describe("movement", () => {
  it("moves the player at its speed along the command", () => {
    const w = testWorld();
    run(w, 60, { moveX: 1, moveY: 0, cast: null });
    expect(playerOf(w).x).toBeCloseTo(100, 5);
  });

  it("never lets a diagonal move faster than a straight one", () => {
    const w = testWorld();
    run(w, 60, { moveX: 1, moveY: 1, cast: null });
    const p = playerOf(w);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(100, 5);
  });

  it("keeps actors inside the arena by their radius", () => {
    const w = testWorld({ "threats/tier-1.json": { durationS: 60, maxAlive: 100, spawns: [] } });
    run(w, 1200, { moveX: 1, moveY: 0, cast: null });
    expect(playerOf(w).x).toBe(990);
  });

  it("faces the way the actor walks", () => {
    const w = testWorld();
    run(w, 5, { moveX: -1, moveY: 0, cast: null });
    expect(playerOf(w).facing).toBe(-1);
    run(w, 5, { moveX: 0, moveY: 1, cast: null });
    expect(playerOf(w).facing).toBe(-1);
  });

  it("chasers walk straight at the player", () => {
    const w = testWorld(chaser);
    const e = place(w, "dummy", 300, 0);
    run(w, 60);
    expect(e.x).toBeCloseTo(240, 1);
    expect(e.y).toBeCloseTo(0, 5);
  });

  it("damps knockback exponentially", () => {
    const w = testWorld();
    const e = place(w, "dummy", 300, 0);
    e.vx = 90;
    run(w, 120);
    expect(e.x - 300).toBeGreaterThan(10);
    expect(e.x - 300).toBeLessThan(13);
    expect(e.vx).toBeLessThan(1);
  });

  it("pushes enemies apart when they overlap", () => {
    const w = testWorld();
    const a = place(w, "dummy", 300, 300);
    const b = place(w, "dummy", 300, 300);
    run(w, 30);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(5);
  });
});
