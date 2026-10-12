import { describe, expect, it } from "vitest";
import { mergeSkill } from "@/content/loadout";
import { resolveSkill } from "@/sim/skills/instance";
import {
  createVolumeStore,
  getVolume,
  releaseVolume,
  spawnVolume,
  type VolumeInit,
} from "@/sim/volumes/store";
import { testContent } from "@/test/content";
import { DMG_A, damageOf } from "@/test/vocab";

describe("VolumeStore", () => {
  const c = testContent();
  const skill = resolveSkill(mergeSkill("boom", c.sim.skills.boom, [], {}), []);
  const init: VolumeInit = {
    kind: "burst",
    vfx: "blast",
    owner: 0,
    ownerDef: "hero",
    team: "player",
    skill,
    node: c.sim.skills.boom.deliver,
    x: 0,
    y: 0,
    dirX: 1,
    dirY: 0,
    speed: 0,
    range: 0,
    radius: 50,
    shape: "circle",
    length: 0,
    halfAngle: Math.PI,
    damageScale: 0.5,
    knockback: 200,
    hitStop: true,
    lifeTicks: 0,
    warnTicks: 0,
    cancelOnOwnerDeath: false,
    ox: 0,
    oy: 0,
    pulseTicks: 0,
    hitsLeft: 0,
  };

  it("snapshots the skill's damage times the node's scale", () => {
    const s = createVolumeStore(2);
    const v = spawnVolume(s, init, 0);
    expect(v?.damage).toEqual(damageOf({ [DMG_A]: 5 }));
    expect(v?.ended).toBe(false);
    expect(v?.travelled).toBe(0);
  });

  it("releases and reuses slots with fresh ids", () => {
    const s = createVolumeStore(1);
    const v = spawnVolume(s, init, 0);
    if (v === null) throw new Error("spawn failed");
    const old = v.id;
    releaseVolume(s, v);
    expect(getVolume(s, old)).toBeNull();
    expect(spawnVolume(s, init, 0)?.id).not.toBe(old);
    expect(spawnVolume(s, init, 0)).toBeNull();
  });
});
