import { describe, expect, it } from "vitest";
import type { SimEvent } from "@/realtime/sim/events";
import { playerOf, type World } from "@/realtime/sim/world";
import { quietZap } from "@/realtime/test/content";
import { DMG_A, ROLE_A, TAG_B, TAG_C } from "@/realtime/test/vocab";
import { castAt, enemies, place, run, runUntilEvent, testWorld } from "@/realtime/test/world";

/**
 * The player at the origin (its zap too short to fire) and one "caster" enemy at (x, 0) whose
 * only skill is `slam`: an auto burst on the player, 5 damage, area 40, range 300, once per 4 s.
 */
function worldWithEnemySkill(
  node: Record<string, unknown>,
  { x = 100, moveSpeed = 0, stats = {} }: { x?: number; moveSpeed?: number; stats?: object } = {},
): World {
  const w = testWorld({
    ...quietZap,
    "skills/slam.json": {
      tags: [TAG_C, TAG_B, DMG_A],
      activation: "auto",
      target: "player",
      stats: { damage: { [DMG_A]: 5 }, rate: 0.25, range: 300, area: 40, knockback: 0, ...stats },
      deliver: { do: "burst", vfx: "mark", shape: { kind: "circle" }, ...node },
    },
    "enemies/caster.json": {
      role: ROLE_A,
      stats: { life: 100, moveSpeed, radius: 10, knockbackResist: 0 },
      behavior: { kind: "chase" },
      skills: ["slam"],
      look: "dummy",
    },
  });
  place(w, "caster", x, 0);
  return w;
}

function only<T extends SimEvent["t"]>(events: SimEvent[], t: T): Extract<SimEvent, { t: T }>[] {
  return events.filter((e): e is Extract<SimEvent, { t: T }> => e.t === t);
}

describe("warned bursts", () => {
  it("never hits while warning, then sweeps once on the tick the warning ends", () => {
    const w = worldWithEnemySkill({ at: "target", warn: 0.5 });
    const started = runUntilEvent(w, "volumeStarted");
    expect(started).toMatchObject({ kind: "burst", warnTicks: 30, x: 0, y: 0, ox: 100, oy: 0 });
    const hp0 = playerOf(w).hp;
    const warning = run(w, 29);
    expect(playerOf(w).hp).toBe(hp0);
    expect(only(warning, "hit")).toEqual([]);
    const events = run(w, 1);
    expect(playerOf(w).hp).toBeLessThan(hp0);
    expect(only(events, "telegraphResolved")).toEqual([
      expect.objectContaining({ id: started.id, hitPlayer: true, ownerDef: "caster", r: 40 }),
    ]);
    const resolve = events.findIndex((e) => e.t === "telegraphResolved");
    const ended = events.findIndex((e) => e.t === "volumeEnded");
    expect(resolve).toBeLessThan(ended);
    expect(only(events, "volumeEnded")[0]).toMatchObject({ id: started.id, cancelled: false });
    expect(only(run(w, 60), "hit")).toEqual([]);
  });

  it("resolves as dodged when the player left the shape", () => {
    const w = worldWithEnemySkill({ at: "target", warn: 0.5 });
    runUntilEvent(w, "volumeStarted");
    const hp0 = playerOf(w).hp;
    run(w, 10);
    playerOf(w).x = -200;
    const events = run(w, 20);
    expect(only(events, "telegraphResolved")).toEqual([
      expect.objectContaining({ hitPlayer: false }),
    ]);
    expect(playerOf(w).hp).toBe(hp0);
  });

  it("counts warn ticks in sim ticks: hit-stop frames don't advance it", () => {
    const stepsToResolve = (freezeAt: number | null): number => {
      const w = worldWithEnemySkill({ at: "target", warn: 0.5 });
      runUntilEvent(w, "volumeStarted");
      for (let n = 1; n <= 100; n++) {
        if (n === freezeAt) w.freezeTicks = 10;
        if (only(run(w, 1), "telegraphResolved").length > 0) return n;
      }
      throw new Error("never resolved");
    };
    expect(stepsToResolve(null)).toBe(30);
    expect(stepsToResolve(5)).toBe(40);
  });

  it("cancels an owner-bound telegraph when its owner dies: no damage, no children, no resolve", () => {
    const w = worldWithEnemySkill({
      at: "target",
      warn: 0.5,
      cancelOnOwnerDeath: true,
      onEnd: [{ do: "burst", shape: { kind: "circle" }, vfx: "none" }],
    });
    const started = runUntilEvent(w, "volumeStarted");
    const hp0 = playerOf(w).hp;
    run(w, 4);
    enemies(w)[0].hp = 0;
    const events = run(w, 60);
    expect(only(events, "volumeEnded")).toEqual([
      expect.objectContaining({ id: started.id, cancelled: true }),
    ]);
    expect(only(events, "telegraphResolved")).toEqual([]);
    expect(only(events, "volumeStarted")).toEqual([]);
    expect(playerOf(w).hp).toBe(hp0);
    expect(w.volumes.alive).toBe(0);
  });

  it("cancels an owner-bound telegraph whose owner dies on its last warning tick", () => {
    const w = worldWithEnemySkill({
      at: "target",
      warn: 0.5,
      cancelOnOwnerDeath: true,
      onEnd: [{ do: "burst", shape: { kind: "circle" }, vfx: "none" }],
    });
    const started = runUntilEvent(w, "volumeStarted");
    const hp0 = playerOf(w).hp;
    run(w, 29);
    enemies(w)[0].hp = 0;
    const events = run(w, 60);
    expect(only(events, "volumeEnded")).toEqual([
      expect.objectContaining({ id: started.id, cancelled: true }),
    ]);
    expect(only(events, "telegraphResolved")).toEqual([]);
    expect(only(events, "volumeStarted")).toEqual([]);
    expect(only(events, "hit")).toEqual([]);
    expect(playerOf(w).hp).toBe(hp0);
  });

  it("does not cancel a telegraph that isn't owner-bound when its owner dies", () => {
    const w = worldWithEnemySkill({ at: "target", warn: 0.5 });
    runUntilEvent(w, "volumeStarted");
    run(w, 4);
    enemies(w)[0].hp = 0;
    const events = run(w, 30);
    expect(only(events, "telegraphResolved")).toEqual([
      expect.objectContaining({ hitPlayer: true }),
    ]);
  });

  it("holds the owner still while its owner-bound telegraph warns, but knockback still moves it", () => {
    const w = worldWithEnemySkill(
      { at: "target", warn: 0.5, cancelOnOwnerDeath: true },
      { x: 200, moveSpeed: 60 },
    );
    const caster = enemies(w)[0];
    runUntilEvent(w, "volumeStarted");
    run(w, 9);
    expect(caster.x).toBe(200);
    // The move intent is zeroed too, not just the speed, so the view's gait stops.
    expect(caster.moveX).toBe(0);
    expect(caster.moveY).toBe(0);
    caster.vx = 300;
    run(w, 1);
    const pushed = caster.x;
    expect(pushed).toBeGreaterThan(200);
    run(w, 5);
    expect(caster.x).toBeGreaterThanOrEqual(pushed);
    // The hold lasts through the sweep tick (tick 31); from tick 32 it walks at the player again.
    run(w, 15);
    const held = caster.x;
    run(w, 10);
    expect(caster.x).toBeLessThan(held);
  });

  it("does not hold the owner of a telegraph that isn't owner-bound", () => {
    const w = worldWithEnemySkill({ at: "target", warn: 0.5 }, { x: 200, moveSpeed: 60 });
    const caster = enemies(w)[0];
    runUntilEvent(w, "volumeStarted");
    run(w, 5);
    expect(caster.x).toBeLessThan(200);
  });

  it("lanes hit bodies along the capsule and miss beside it", () => {
    // From the caster at (100, 0) toward the player: a lane 300 long, half-width 10, to x = -200.
    const lane = { shape: { kind: "lane" }, warn: 0.1 };
    const along = worldWithEnemySkill(lane, { stats: { area: 10 } });
    const started = runUntilEvent(along, "volumeStarted");
    expect(started).toMatchObject({ shape: "lane", length: 300, r: 10, x: 100, y: 0 });
    expect(started.dirX).toBeCloseTo(-1);
    playerOf(along).x = -150;
    expect(only(run(along, 6), "telegraphResolved")).toEqual([
      expect.objectContaining({ hitPlayer: true }),
    ]);

    const beside = worldWithEnemySkill(lane, { stats: { area: 10 } });
    runUntilEvent(beside, "volumeStarted");
    playerOf(beside).x = -150;
    playerOf(beside).y = 25;
    const events = run(beside, 6);
    expect(only(events, "telegraphResolved")).toEqual([
      expect.objectContaining({ hitPlayer: false }),
    ]);
    expect(only(events, "hit")).toEqual([]);

    const past = worldWithEnemySkill(lane, { stats: { area: 10 } });
    runUntilEvent(past, "volumeStarted");
    playerOf(past).x = -225;
    expect(only(run(past, 6), "telegraphResolved")).toEqual([
      expect.objectContaining({ hitPlayer: false }),
    ]);
  });

  it("places count marks: the first on the target, the rest within scatter, all inside the arena", () => {
    const w = worldWithEnemySkill({ at: "target", warn: 0.5, count: 5, scatter: 60 });
    const p = playerOf(w);
    p.x = 990;
    p.y = 990;
    const caster = enemies(w)[0];
    caster.x = 900;
    caster.y = 900;
    const events = run(w, 2);
    const marks = only(events, "volumeStarted");
    expect(marks).toHaveLength(5);
    expect(marks[0]).toMatchObject({ x: 990, y: 990, ox: 900, oy: 900 });
    for (const m of marks) {
      expect(Math.abs(m.x)).toBeLessThanOrEqual(1000);
      expect(Math.abs(m.y)).toBeLessThanOrEqual(1000);
      expect(Math.hypot(m.x - 990, m.y - 990)).toBeLessThanOrEqual(60);
    }
    expect(new Set(marks.map((m) => `${m.x},${m.y}`)).size).toBe(5);
  });

  it("puts an `at: self` burst on the caster", () => {
    const w = worldWithEnemySkill({ warn: 0.5 });
    expect(runUntilEvent(w, "volumeStarted")).toMatchObject({ x: 100, y: 0, ox: 100, oy: 0 });
  });

  it("a volume with warn 0 has no telegraph and hits the next tick", () => {
    const w = testWorld(quietZap);
    const d = place(w, "dummy", 100, 0);
    const events = [...run(w, 1, castAt(1, 0)), ...run(w, 30)];
    const burst = only(events, "volumeStarted").find((e) => e.kind === "burst");
    if (burst === undefined) throw new Error("no burst");
    expect(burst).toMatchObject({ warnTicks: 0, shape: "circle", length: 0 });
    const hit = only(events, "hit").find((e) => e.target === d.id);
    expect(hit?.tick).toBe(burst.tick + 1);
    expect(only(events, "telegraphResolved")).toEqual([]);
  });
});
