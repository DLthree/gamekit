import { z } from "zod";
import { SchemaRef } from "@/content/schema/vocab";
import { Activation, DamageType, Tag } from "@/realtime/content/schema/vocab";

export const Target = z.enum(["nearest", "aim", "player"]);
export type Target = z.infer<typeof Target>;

export const BurstShape = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("circle") }),
  z.strictObject({ kind: z.literal("arc"), halfAngleDeg: z.number().positive().max(180) }),
  /** A capsule from the delivery point along its direction: length = range, half-width = area. */
  z.strictObject({ kind: z.literal("lane") }),
]);
export type BurstShape = z.infer<typeof BurstShape>;

/**
 * How a projectile node aims its `projectileCount` projectiles: `fan` spreads them over `spread`
 * around the one targeted direction; `nearest` sends one at each of the nearest enemies in range
 * (cycling when there are fewer; `fan` when there are none); `nova` spaces them evenly around
 * 360° from the targeted direction; `scatter` sends each in a random direction.
 */
export const Multishot = z.enum(["fan", "nearest", "nova", "scatter"]);
export type Multishot = z.infer<typeof Multishot>;

const projectileShape = {
  do: z.literal("projectile"),
  multishot: Multishot,
  vfx: z.string().min(1),
  radius: z.number().positive(),
  /** "trigger": the first contact only ends the projectile; its onEnd actions deal the damage. */
  impact: z.enum(["damage", "trigger"]),
  damageScale: z.number().positive().default(1),
};

const burstShape = {
  do: z.literal("burst"),
  vfx: z.string().min(1),
  shape: BurstShape,
  areaScale: z.number().positive().default(1),
  damageScale: z.number().positive().default(1),
  hitStop: z.boolean().default(false),
  /** Seconds the burst warns (harmless, drawn as a telegraph) before its one sweep. */
  warn: z.number().nonnegative().default(0),
  /** Owner-bound: cancelled if the caster dies while warning; the caster holds still. */
  cancelOnOwnerDeath: z.boolean().default(false),
  /** "self": at the delivery point; "target": at the delivery's target point. */
  at: z.enum(["self", "target"]).default("self"),
  count: z.number().int().positive().default(1),
  /** count > 1: marks after the first land uniformly within this radius of the target. */
  scatter: z.number().nonnegative().default(0),
};

/** The primitive kinds a delivery tree is built from (modifier `attach.to`). */
export const PRIMITIVE_KINDS = ["projectile", "burst", "zone", "dash"] as const;
export const PrimitiveKind = z.enum(PRIMITIVE_KINDS);
export type PrimitiveKind = z.infer<typeof PrimitiveKind>;

/** The primitive kinds that draw a vfx (modifier `look`, tier `look` keys). A dash has none. */
export const LOOK_KINDS = ["projectile", "burst", "zone"] as const;
export const LookKind = z.enum(LOOK_KINDS);
export type LookKind = z.infer<typeof LookKind>;

const zoneShape = {
  do: z.literal("zone"),
  vfx: z.string().min(1),
  /** Where the zone goes while it lives. Zones stay put. */
  motion: z.enum(["static"]),
  areaScale: z.number().positive().default(1),
  damageScale: z.number().positive().default(1),
};

/** Reads the skill's range and duration to move its owner in a straight line. */
const dashShape = {
  do: z.literal("dash"),
};

const ProjectileFields = z.strictObject(projectileShape);
const BurstFields = z.strictObject(burstShape);
const ZoneFields = z.strictObject(zoneShape);
const DashFields = z.strictObject(dashShape);

interface Children {
  onEnd: DeliveryNode[];
  /**
   * The odds (0–1] this node runs each time its parent ends; absent, it always runs. Only
   * mergeSkill sets it, from a modifier's `attach.chance`: the strict schema keeps it out of
   * skill files.
   */
  chance?: number;
}
export type ProjectileNode = z.infer<typeof ProjectileFields> & Children;
export type BurstNode = z.infer<typeof BurstFields> & Children;
export type ZoneNode = z.infer<typeof ZoneFields> & Children;
export type DashNode = z.infer<typeof DashFields> & Children;
/** A skill's behaviour: a tree of primitives; children in onEnd run where the parent ended. */
export type DeliveryNode = ProjectileNode | BurstNode | ZoneNode | DashNode;

export const DeliveryNode: z.ZodType<DeliveryNode> = z.lazy(() =>
  z.discriminatedUnion("do", [
    z.strictObject({ ...projectileShape, onEnd: z.array(DeliveryNode).default([]) }),
    z.strictObject({ ...burstShape, onEnd: z.array(DeliveryNode).default([]) }),
    z.strictObject({ ...zoneShape, onEnd: z.array(DeliveryNode).default([]) }),
    z.strictObject({ ...dashShape, onEnd: z.array(DeliveryNode).default([]) }),
  ]),
);

/** Base numbers. Which optional ones a skill needs is checked across files (content/check.ts). */
export const SkillStats = z.strictObject({
  damage: z.partialRecord(DamageType, z.number().nonnegative()),
  range: z.number().positive(),
  knockback: z.number().nonnegative(),
  cooldown: z.number().positive().optional(),
  rate: z.number().positive().optional(),
  area: z.number().positive().optional(),
  duration: z.number().positive().optional(),
  pulse: z.number().positive().optional(),
  projectileSpeed: z.number().positive().optional(),
  projectileCount: z.number().int().positive().optional(),
  spread: z.number().nonnegative().optional(),
  pierce: z.number().int().nonnegative().optional(),
});
export type SkillStats = z.infer<typeof SkillStats>;

export const Skill = z.strictObject({
  $schema: SchemaRef,
  tags: z.array(Tag).min(1),
  activation: Activation,
  target: Target,
  stats: SkillStats,
  deliver: DeliveryNode,
});
export type Skill = z.infer<typeof Skill>;
