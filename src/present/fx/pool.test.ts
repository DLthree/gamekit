import { describe, expect, it } from "vitest";
import { FxPool, type FxSpawn } from "@/present/fx/pool";
import { testContent } from "@/test/content";

function lookFx(cap: number, evict: boolean, capacity = 100) {
  const fx = structuredClone(testContent().look.fx);
  fx.capacity = capacity;
  fx.kinds.puff = { ...fx.kinds.puff, cap, evict };
  return fx;
}

const spawnAt = (at: number, life = 1): FxSpawn => ({
  kind: "puff",
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  at,
  life,
  size: 10,
  rot: 0,
  spin: 0,
  variant: 0,
  tint: 0xffffff,
  alpha: 1,
  seed: 0.5,
});

describe("FxPool", () => {
  it("drops spawns past a kind's cap and counts them", () => {
    const pool = new FxPool(lookFx(2, false));
    for (let i = 0; i < 5; i++) pool.spawn(spawnAt(i));
    expect(pool.counts()).toEqual({
      total: 2,
      dropped: 3,
      droppedByKind: { puff: 3 },
      kinds: { puff: 2, ring: 0, "gold-flake": 0 },
    });
  });

  it("names the kind that dropped", () => {
    const pool = new FxPool(lookFx(2, false));
    for (let i = 0; i < 3; i++) pool.spawn(spawnAt(0));
    expect(pool.counts()).toMatchObject({ dropped: 1, droppedByKind: { puff: 1 } });
  });

  it("evicts the instance ending soonest for evict kinds", () => {
    const pool = new FxPool(lookFx(2, true));
    pool.spawn(spawnAt(0, 5));
    pool.spawn(spawnAt(0, 1));
    pool.spawn(spawnAt(1, 5));
    const ends = pool.items.filter((i) => i.alive).map((i) => i.at + i.life);
    expect(ends.sort()).toEqual([5, 6]);
    expect(pool.dropped).toBe(0);
  });

  it("respects the total capacity", () => {
    const pool = new FxPool(lookFx(50, false, 3));
    for (let i = 0; i < 5; i++) pool.spawn(spawnAt(0));
    expect(pool.counts().total).toBe(3);
    expect(pool.dropped).toBe(2);
  });

  it("drains to zero once spawning stops", () => {
    const pool = new FxPool(lookFx(50, false));
    for (let i = 0; i < 10; i++) pool.spawn(spawnAt(0, 0.5));
    pool.stopped = true;
    pool.spawn(spawnAt(0.4));
    pool.expire(0.49);
    expect(pool.counts().total).toBe(10);
    pool.expire(0.5);
    expect(pool.counts().total).toBe(0);
    expect(pool.dropped).toBe(0);
  });
});
