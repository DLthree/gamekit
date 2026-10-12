import type { DamageType, Tag } from "@/content/schema/vocab";
import type { Id } from "@/core/ids";
import { DAMAGE_TYPES } from "@/game/vocab";
import { knockbackImpulse } from "@/sim/combat/knockback";

/** Snapshotted when the volume was born; applied by one pure function. */
export interface DamagePacket {
  source: Id;
  owner: Id;
  ownerDef: string;
  skill: string;
  tags: readonly Tag[];
  amounts: Record<DamageType, number>;
  knockback: number;
  originX: number;
  originY: number;
  /** The volume's heading: the push for a dead-centre hit. */
  dirX: number;
  dirY: number;
}

export interface HitTarget {
  hp: number;
  x: number;
  y: number;
  knockbackResist: number;
}

export interface HitResult {
  damage: number;
  killed: boolean;
  kx: number;
  ky: number;
}

/** Damage is the sum of the amounts: no armour, no resistances (their seam is here). */
export function resolveHit(packet: DamagePacket, target: HitTarget): HitResult {
  let damage = 0;
  for (const type of DAMAGE_TYPES) damage += packet.amounts[type];
  const k = knockbackImpulse(
    packet.originX,
    packet.originY,
    target.x,
    target.y,
    { x: packet.dirX, y: packet.dirY },
    packet.knockback,
    target.knockbackResist,
  );
  return { damage, killed: target.hp - damage <= 0, kx: k.x, ky: k.y };
}
