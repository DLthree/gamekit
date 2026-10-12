import { describe, expect, it } from "vitest";
import { tickSeconds } from "@/core/clock";
import { createRng } from "@/core/rng";
import { FxPool } from "@/present/fx/pool";
import type { HeadDraw } from "@/present/fx/recipes/projectile";
import { ProjectileTracker } from "@/present/fx/trails";
import { testContent } from "@/test/content";
import { place, run, testWorld } from "@/test/world";

describe("ProjectileTracker", () => {
  it("follows a live projectile, drops a trail puff every everyS and forgets it when it ends", () => {
    const content = testContent();
    const w = testWorld();
    // x=100 (not 180): the first bolt must land before the next cast fires (rate 2 => every
    // 0.5s), or two projectiles overlap and the tracker legitimately tracks more than one head.
    place(w, "dummy", 100, 0);
    const em = { pool: new FxPool(content.look.fx), rng: createRng(1), look: content.look };
    const tracker = new ProjectileTracker(content.look);
    const heads: HeadDraw[] = [];
    let trails = 0;
    for (let i = 0; i < 60; i++) {
      run(w, 1);
      const t = tickSeconds(w.tick);
      for (const e of w.events.items) {
        const vfx =
          content.look.fx.vfx[e.t === "volumeStarted" || e.t === "volumeEnded" ? e.vfx : "none"];
        if (e.t === "volumeStarted" && e.kind === "projectile" && vfx.recipe === "projectile") {
          tracker.start(e.id, vfx, "red", t);
        }
        if (e.t === "volumeEnded" && e.kind === "projectile") tracker.end(e.id);
      }
      tracker.update(w, em, t);
      if (tracker.size > 0) {
        expect(tracker.heads(t, heads)).toBe(1);
        expect(heads[0]?.tint).toBe(0xe52b0a);
      }
      trails = em.pool.counts().kinds.puff;
    }
    expect(trails).toBeGreaterThan(3);
    expect(tracker.size).toBe(0);
  });

  it("refuses a build-tinted head whose owner has no build colour", () => {
    const content = testContent();
    const vfx = Object.values(content.look.fx.vfx).find((v) => v.recipe === "projectile");
    if (vfx === undefined || vfx.recipe !== "projectile") throw new Error("no projectile vfx");
    const tracker = new ProjectileTracker(content.look);
    expect(() => tracker.start(1, vfx, null, 0)).toThrow("is tinted by build colour");
  });
});
