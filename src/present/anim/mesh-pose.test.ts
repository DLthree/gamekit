import { describe, expect, it } from "vitest";
import { createRng } from "@/core/rng";
import { ActorAnims } from "@/present/anim/creatures";
import { drawMeshActor, newMeshDraw } from "@/present/anim/mesh-pose";
import { meshFiles, testContent } from "@/test/content";

const meshContent = () => testContent(meshFiles());
const hero = {
  id: 1,
  def: "hero",
  x: 100,
  y: 50,
  facing: 1 as const,
  moveX: 0,
  moveY: 0,
  isPlayer: true,
};

describe("drawMeshActor", () => {
  it("draws the body in world units (no image scale) and the prop at the hand", () => {
    const c = meshContent();
    const d = drawMeshActor(c, new ActorAnims(createRng(1), 0), hero, 0, newMeshDraw(c, "hero"));
    expect(d.body.scaleX).toBeCloseTo(1, 1);
    expect(d.body.frame).toBe("creature/hero");
    expect(d.prop).toMatchObject({ frame: "prop/staff", originX: 0.5, originY: 0.6 });
    // Idle bob, breathing and the bend move the hand by well under 1.5 units.
    expect(Math.abs((d.prop?.x ?? 0) - (100 + 0.4 * 20))).toBeLessThan(1.5);
    expect(Math.abs((d.prop?.y ?? 0) - (50 - 0.4 * 20))).toBeLessThan(1.5);
    expect(d.prop?.scaleX).toBeCloseTo(4 / 20);
    expect(d.prop?.depth).toBeGreaterThan(d.body.depth);
  });

  it("mirrors the prop with the facing", () => {
    const c = meshContent();
    const d = drawMeshActor(
      c,
      new ActorAnims(createRng(1), 0),
      { ...hero, facing: -1 },
      0,
      newMeshDraw(c, "hero"),
    );
    expect(d.prop?.x).toBeLessThan(100);
    expect(d.prop?.scaleX).toBeLessThan(0);
  });

  it("thrusts the prop after a manual cast, and rests after thrustS", () => {
    const c = meshContent();
    const anims = new ActorAnims(createRng(1), 0);
    const rest = drawMeshActor(c, anims, hero, 1, newMeshDraw(c, "hero")).prop?.rot ?? 0;
    anims.thrust(1, 1);
    const jab = drawMeshActor(c, anims, hero, 1.2, newMeshDraw(c, "hero")).prop?.rot ?? 0;
    expect(jab).toBeGreaterThan(rest + 0.5);
    const after = drawMeshActor(c, anims, hero, 1.5, newMeshDraw(c, "hero")).prop?.rot ?? 0;
    expect(Math.abs(after - rest)).toBeLessThan(0.15);
  });

  it("refuses a creature without a mesh", () => {
    const c = testContent();
    expect(() => newMeshDraw(c, "hero")).toThrow("hero is not a mesh creature");
  });
});
