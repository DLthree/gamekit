import { describe, expect, it } from "vitest";
import {
  type ActorInit,
  createActorStore,
  getActor,
  releaseActor,
  spawnActor,
} from "@/sim/actors/store";
import { ROLE_A } from "@/test/vocab";

const init: ActorInit = {
  def: "dummy",
  team: "enemy",
  role: ROLE_A,
  x: 1,
  y: 2,
  radius: 10,
  hp: 5,
  moveSpeed: 0,
  knockbackResist: 0,
  skills: [],
};

describe("ActorStore", () => {
  it("spawns into a free slot with every field set", () => {
    const s = createActorStore(4);
    const a = spawnActor(s, init);
    expect(a).not.toBeNull();
    if (a === null) return;
    expect(a.alive).toBe(true);
    expect([a.x, a.y, a.hp, a.maxHp, a.vx, a.vy, a.facing]).toEqual([1, 2, 5, 5, 0, 0, 1]);
    expect(getActor(s, a.id)).toBe(a);
    expect(s.alive).toBe(1);
  });

  it("gives a reused slot a new id, so a stale id resolves to nothing", () => {
    const s = createActorStore(1);
    const a = spawnActor(s, init);
    if (a === null) throw new Error("spawn failed");
    const old = a.id;
    releaseActor(s, a);
    const b = spawnActor(s, init);
    if (b === null) throw new Error("respawn failed");
    expect(b.slot).toBe(a.slot);
    expect(b.id).not.toBe(old);
    expect(getActor(s, old)).toBeNull();
  });

  it("returns null when full", () => {
    const s = createActorStore(1);
    spawnActor(s, init);
    expect(spawnActor(s, init)).toBeNull();
  });
});
