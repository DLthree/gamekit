import { describe, expect, it } from "vitest";
import { createRng } from "@/core/rng";
import { ActorAnims } from "@/present/anim/creatures";
import { drawMeshActor, drawMeshGhost, newMeshDraw } from "@/present/anim/mesh-pose";
import { staffFiles, testContent } from "@/test/content";

const meshContent = () => testContent(staffFiles());
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

/** The test hero patched: a rigid gait, drawn at `scale`. */
function heroAs(gaitKind: string, scale: number) {
  const files = staffFiles();
  const creatures = files["look/creatures.json"] as {
    creatures: Record<string, { gait: Record<string, unknown>; scale?: number }>;
  };
  creatures.creatures.hero.gait.kind = gaitKind;
  creatures.creatures.hero.scale = scale;
  return testContent(files);
}

describe("drawMeshActor", () => {
  it("leaves a rigid creature's grid at rest while it walks, and draws it at its scale", () => {
    const c = heroAs("rigid", 2);
    const walking = { ...hero, moveX: 1 };
    const rest = newMeshDraw(c, "hero");
    const at = [...rest.grid.vertices];
    const d = drawMeshActor(c, new ActorAnims(createRng(1), 0), walking, 0.3, rest);
    expect(d.grid.vertices).toEqual(at);
    expect(d.grid.height).toBe(40);
    expect(d.prop?.scaleX).toBeCloseTo((2 * 4) / 20);
  });

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

  it("bends the grid as it walks, and holds it at rest when idle", () => {
    const c = meshContent();
    const anims = new ActorAnims(createRng(1), 0);
    const idle = [...drawMeshActor(c, anims, hero, 1.1, newMeshDraw(c, "hero")).grid.vertices];
    const idle2 = [...drawMeshActor(c, anims, hero, 1.3, newMeshDraw(c, "hero")).grid.vertices];
    const walk = drawMeshActor(c, anims, { ...hero, moveX: 1 }, 1.3, newMeshDraw(c, "hero"));
    const moved = (a: number[], b: number[]) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
    expect(moved(idle, idle2)).toBeLessThan(0.5);
    expect(moved(idle2, walk.grid.vertices)).toBeGreaterThan(0.5);
  });

  it("pops a ghost: swells, flashes and fades with its prop, then vanishes", () => {
    const c = meshContent();
    const g = { id: 1, def: "hero", x: 100, y: 50, facing: 1 as const, at: 2 };
    const durationS = c.look.feedback.death.durationS;
    const early = drawMeshGhost(c, g, 2.01, newMeshDraw(c, "hero"));
    expect(early.body.flash).toBe(true);
    expect(early.body.scaleY).toBeGreaterThan(1);
    const late = drawMeshGhost(c, g, 2 + durationS * 0.9, newMeshDraw(c, "hero"));
    expect(late.body.scaleY).toBeLessThan(0.5);
    expect(late.body.alpha).toBeLessThan(0.5);
    expect(Math.abs(late.prop?.scaleY ?? 1)).toBeLessThan(Math.abs(early.prop?.scaleY ?? 0));
    expect(drawMeshGhost(c, g, 2 + durationS * 1.01, newMeshDraw(c, "hero")).body.visible).toBe(
      false,
    );
  });
});
