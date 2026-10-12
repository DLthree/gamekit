import { describe, expect, it } from "vitest";
import { type DamagePacket, resolveHit } from "@/sim/combat/damage";

const packet: DamagePacket = {
  source: 1,
  owner: 2,
  ownerDef: "hero",
  skill: "boom",
  tags: ["fire"],
  amounts: { fire: 6, physical: 1 },
  knockback: 100,
  originX: 0,
  originY: 0,
  dirX: 0,
  dirY: 1,
};

describe("resolveHit", () => {
  it("sums the damage types and reports a kill", () => {
    expect(resolveHit(packet, { hp: 10, x: 10, y: 0, knockbackResist: 0 })).toMatchObject({
      damage: 7,
      killed: false,
    });
    expect(resolveHit(packet, { hp: 7, x: 10, y: 0, knockbackResist: 0 }).killed).toBe(true);
  });

  it("pushes away from the origin, scaled down by knockback resist", () => {
    const r = resolveHit(packet, { hp: 10, x: 10, y: 0, knockbackResist: 0.5 });
    expect(r.kx).toBeCloseTo(50);
    expect(r.ky).toBeCloseTo(0);
  });

  it("pushes a dead-centre target along the packet direction, never NaN", () => {
    const r = resolveHit(packet, { hp: 10, x: 0, y: 0, knockbackResist: 0 });
    expect([r.kx, r.ky]).toEqual([0, 100]);
  });

  it("a resist of 1 means no push", () => {
    const r = resolveHit(packet, { hp: 10, x: 10, y: 0, knockbackResist: 1 });
    expect([r.kx, r.ky]).toEqual([0, 0]);
  });
});
