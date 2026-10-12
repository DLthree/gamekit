import { describe, expect, it } from "vitest";
import type { LookContent } from "@/content/types";
import { createRng } from "@/core/rng";
import type { Emitter } from "@/realtime/present/fx/emit";
import { FxPool } from "@/realtime/present/fx/pool";
import { explosion } from "@/realtime/present/fx/recipes/explosion";
import { groundFire } from "@/realtime/present/fx/recipes/ground";
import { deathInk, goldFlakes, hitInk } from "@/realtime/present/fx/recipes/ink";
import { headDraw, newHeadDraw, trailStep } from "@/realtime/present/fx/recipes/projectile";
import { testContent, testFiles } from "@/realtime/test/content";

/** Signed distance from `a` to `b` in radians, wrapped to (-π, π]; angles differing by a multiple
 * of 2π (e.g. atan2's -π vs the 1.5π a caller might expect) are treated as equal. */
function angleDelta(a: number, b: number): number {
  const raw = a - b;
  return raw - 2 * Math.PI * Math.round(raw / (2 * Math.PI));
}

function emitter(): Emitter {
  const look = testContent().look;
  return { pool: new FxPool(look.fx), rng: createRng(5), look };
}

describe("recipes", () => {
  it("an explosion draws a ring sized from the radius, delayed smoke, and names its shake", () => {
    const em = emitter();
    const vfx = em.look.fx.vfx.blast;
    if (vfx.recipe !== "explosion") throw new Error("blast is an explosion");
    expect(explosion(em, vfx, 10, 20, 50, 1, null)).toBe("blast");
    const live = em.pool.items.filter((i) => i.alive);
    expect(live).toHaveLength(2);
    expect(live[0]).toMatchObject({ kind: "puff", x: 10, y: 20, size: 100, at: 1 });
    expect(live[1].at).toBeCloseTo(1.05);
  });

  it("a trail puff drifts back along the flight", () => {
    const em = emitter();
    const vfx = em.look.fx.vfx.zap;
    if (vfx.recipe !== "projectile") throw new Error("zap is a projectile");
    trailStep(em, vfx, 0, 0, 1, 0, 300, 2, null);
    const puff = em.pool.items[0];
    expect(puff.vx).toBeLessThan(0);
    expect(puff.at).toBe(2);
  });

  it("a projectile head trails its texture's top behind the motion and pulses", () => {
    const em = emitter();
    const vfx = em.look.fx.vfx.zap;
    if (vfx.recipe !== "projectile") throw new Error("zap is a projectile");
    const flat = { ...vfx, head: { ...vfx.head, spinHz: 0, pulse: 0 } };
    const h = headDraw(flat, 5, 6, 1, 0, 0, newHeadDraw());
    expect(h).toMatchObject({ texture: "spark", frame: 0, x: 5, y: 6, size: 10 });
    expect(Math.sin(h.rot)).toBeCloseTo(-1);
  });

  it("an explosion with a scorch leaves one sized from the radius", () => {
    const fx = structuredClone(testFiles()["look/fx.json"]) as {
      vfx: Record<string, Record<string, unknown>>;
    };
    fx.vfx.blast.scorch = { kind: "puff", scale: 0.5 };
    const look = testContent({ "look/fx.json": fx }).look;
    const em: Emitter = { pool: new FxPool(look.fx), rng: createRng(5), look };
    const vfx = look.fx.vfx.blast;
    if (vfx.recipe !== "explosion") throw new Error("blast is an explosion");
    explosion(em, vfx, 0, 0, 50, 1, null);
    const live = em.pool.items.filter((i) => i.alive);
    expect(live).toHaveLength(3);
    expect(live[1]).toMatchObject({ kind: "puff", size: 50, at: 1 });
  });

  it("a flame trail drops a short-lived flame pointing back along the flight", () => {
    const fx = structuredClone(testFiles()["look/fx.json"]) as {
      vfx: Record<string, { trail: Record<string, unknown> }>;
    };
    fx.vfx.zap.trail.flame = { kind: "puff", scale: 2, lifeS: 0.2 };
    const look = testContent({ "look/fx.json": fx }).look;
    const em: Emitter = { pool: new FxPool(look.fx), rng: createRng(5), look };
    const vfx = look.fx.vfx.zap;
    if (vfx.recipe !== "projectile") throw new Error("zap is a projectile");
    trailStep(em, vfx, 0, 0, 1, 0, 300, 2, null);
    const flame = em.pool.items[1];
    expect(flame).toMatchObject({ life: 0.2, size: 16, at: 2 });
    expect(Math.abs(angleDelta(flame.rot, 1.5 * Math.PI))).toBeLessThanOrEqual(0.3);
  });

  it("hits and deaths leave ink at mid-body", () => {
    const em = emitter();
    hitInk(em, 0, 100, 20, 0);
    deathInk(em, 0, 100, 20, 0);
    const live = em.pool.items.filter((i) => i.alive);
    expect(live).toHaveLength(3);
    expect(live[0].y).toBeCloseTo(90);
  });
});

/** Test look with a ground vfx "burn" whose pieces use their own kinds; grass evicts at 5. */
function groundLook(): LookContent {
  const fx = structuredClone(testFiles()["look/fx.json"]) as {
    kinds: Record<string, Record<string, unknown>>;
    vfx: Record<string, unknown>;
  };
  const puff = fx.kinds.puff;
  fx.kinds.stain = { ...puff };
  fx.kinds.grass = { ...puff, cap: 5, evict: true, life: 4 };
  fx.kinds.ember = { ...puff, life: 1 };
  fx.vfx.burn = {
    recipe: "ground",
    stains: { kind: "stain", count: 2, alpha: 0.9, size: [0.6, 1] },
    grass: { kind: "grass", count: 4, size: [30, 50] },
    flames: { kind: "puff", count: 2, size: [14, 32] },
    embers: { kind: "ember", count: 3, size: 6 },
    spreadS: 1.5,
    flat: 0.72,
    sound: null,
  };
  return testContent({ "look/fx.json": fx }).look;
}

describe("groundFire", () => {
  it("gold flakes scatter over the body height and pop upward", () => {
    const em = emitter();
    goldFlakes(em, 100, 200, 40, 1, 5);
    const flakes = em.pool.items.filter((i) => i.alive);
    expect(flakes).toHaveLength(5);
    for (const f of flakes) {
      expect(f.kind).toBe("gold-flake");
      expect(f.y).toBeLessThanOrEqual(200);
      expect(f.y).toBeGreaterThanOrEqual(160);
      expect(f.vy).toBeLessThan(0);
    }
    expect(new Set(flakes.map((f) => f.x)).size).toBe(5);
  });

  function burn() {
    const look = groundLook();
    const em: Emitter = { pool: new FxPool(look.fx), rng: createRng(9), look };
    const vfx = look.fx.vfx.burn;
    if (vfx.recipe !== "ground") throw new Error("burn is a ground recipe");
    return { em, vfx };
  }

  it("spreads pieces through the slanted patch, catching from the centre out", () => {
    const { em, vfx } = burn();
    groundFire(em, vfx, 100, 200, 50, 4, 1, null);
    expect(em.pool.counts().kinds).toMatchObject({ stain: 2, grass: 4, puff: 2, ember: 3 });
    for (const g of em.pool.items.filter((i) => i.kind === "grass" || i.kind === "puff")) {
      const u = Math.hypot((g.x - 100) / 50, (g.y - 200) / (50 * 0.72));
      expect(u).toBeLessThanOrEqual(0.9 + 1e-9);
      expect(g.at - 1).toBeCloseTo(u * 1.5, 6);
      expect(g.at + g.life).toBeLessThanOrEqual(1 + 4 + 1e-9);
    }
  });

  it("evict kinds keep a flood of patches bounded", () => {
    const { em, vfx } = burn();
    for (let k = 0; k < 3; k++) groundFire(em, vfx, 0, 0, 50, 4, k, null);
    expect(em.pool.counts().kinds.grass).toBe(5);
    expect(em.pool.counts().droppedByKind.grass).toBeUndefined();
  });
});
