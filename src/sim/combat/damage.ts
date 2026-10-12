import type { DamageType, Tag } from "@/content/schema/vocab";
import type { Id } from "@/core/ids";
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

/** MVP damage is the sum of the amounts: no armour, no resistances (their seam is here). */
export function resolveHit(packet: DamagePacket, target: HitTarget): HitResult {
  const damage = packet.amounts.fire + packet.amounts.physical;
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
