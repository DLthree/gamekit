import { describe, expect, it } from "vitest";
import { createRng } from "@/core/rng";
import { ActorAnims, bodyHeight } from "@/present/anim/creatures";
import { drawActor, drawGhost, newActorDraw } from "@/present/anim/pose";
import { testContent } from "@/test/content";

describe("drawActor", () => {
  const c = testContent();
  const input = {
    id: 7,
    def: "dummy",
    x: 100,
    y: 50,
    facing: -1 as const,
    moveX: 0,
    moveY: 0,
    isPlayer: false,
  };

  it("scales the sprite to its world size, mirrored for left-facing", () => {
    const anims = new ActorAnims(createRng(1), 0);
    const d = drawActor(c, anims, input, 0, newActorDraw());
    expect(d.frame).toBe("creature/dummy");
    expect(d.scaleX).toBeLessThan(0);
    expect(Math.abs(d.scaleX)).toBeCloseTo(20 / 90, 1);
    expect(d.flash).toBe(false);
    expect(d.shadowX).toBe(100);
  });

  it("flashes after a hit and draws the player in the player band", () => {
    const anims = new ActorAnims(createRng(1), 0);
    anims.hit(7, 1, 0.1);
    expect(drawActor(c, anims, input, 1.05, newActorDraw()).flash).toBe(true);
    const p = drawActor(
      c,
      anims,
      { ...input, id: 1, def: "hero", isPlayer: true },
      1,
      newActorDraw(),
    );
    const e = drawActor(c, anims, { ...input, y: 900 }, 1, newActorDraw());
    expect(p.depth).toBeGreaterThan(e.depth);
  });

  it("keeps a ghost for the death pop, then prunes it", () => {
    const anims = new ActorAnims(createRng(1), 0);
    drawActor(c, anims, input, 0, newActorDraw());
    anims.died(7, "dummy", 100, 50, 2);
    expect(anims.ghosts).toHaveLength(1);
    expect(anims.ghosts[0].facing).toBe(-1);
    expect(drawGhost(c, anims.ghosts[0], 2.05, newActorDraw()).visible).toBe(true);
    anims.prune(3, c.look.feedback.death.durationS);
    expect(anims.ghosts).toHaveLength(0);
    expect(bodyHeight(c, "dummy")).toBe(20);
  });

  it("limits hit feedback per target to one per hitLimitS", () => {
    const anims = new ActorAnims(createRng(1), 0);
    expect(anims.hit(7, 1, 0.1)).toBe(true);
    expect(anims.hit(7, 1.05, 0.1)).toBe(false);
    expect(anims.hit(8, 1.05, 0.1)).toBe(true);
    expect(anims.hit(7, 1.1, 0.1)).toBe(true);
  });

  it("recoils the player away from its cast's aim", () => {
    const anims = new ActorAnims(createRng(1), 0);
    const player = { ...input, id: 1, def: "hero", isPlayer: true, facing: 1 as const };
    const rest = drawActor(c, anims, player, 1, newActorDraw()).x;
    anims.cast(1, 1, 1, 0);
    expect(drawActor(c, anims, player, 1.01, newActorDraw()).x).toBeLessThan(rest);
    anims.cast(1, 2, -1, 0);
    expect(drawActor(c, anims, { ...player, facing: -1 }, 2.01, newActorDraw()).x).toBeGreaterThan(
      player.x,
    );
  });
});
