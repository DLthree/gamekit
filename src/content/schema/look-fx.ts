import { z } from "zod";
import { Band } from "@/content/schema/look";
import { ContentId, SchemaRef } from "@/content/schema/vocab";

const positive = z.number().positive();
const nonNegative = z.number().nonnegative();
const unitInterval = z.number().min(0).max(1);

/**
 * Long-lived ground pieces (burning grass, ground flames): a gentle rock and breathe, each
 * instance at its own rate and phase, and a slow swap through the texture's frames.
 */
export const Sway = z.strictObject({
  amount: nonNegative,
  hz: positive,
  breathe: nonNegative,
  breatheHz: positive,
  /** Seconds per frame swap; 0 keeps one frame. */
  swapS: nonNegative,
});
export type Sway = z.infer<typeof Sway>;

/**
 * One effect kind: a texture animated by code. `tint` is "build" (the owner's build
 * colour) or a palette name; ink kinds use "white", which a multiply tint leaves unchanged.
 */
export const FxKind = z.strictObject({
  texture: ContentId,
  /** How many of the texture's frames to use; null = all. */
  variants: z.number().int().positive().nullable(),
  cap: z.number().int().positive(),
  /** At its cap, free the instance ending soonest instead of dropping the new one. */
  evict: z.boolean(),
  band: Band,
  tint: ContentId,
  life: positive,
  growS: nonNegative,
  scaleFrom: nonNegative,
  scaleTo: nonNegative,
  popS: nonNegative,
  fadeFrom: unitInterval,
  alpha: unitInterval,
  drag: nonNegative,
  rise: z.number(),
  flicker: nonNegative,
  flickerHz: nonNegative,
  sway: Sway.nullable(),
});
export type FxKind = z.infer<typeof FxKind>;

/** A projectile's look while it flies: a spinning, pulsing head and a trail of puffs. */
export const ProjectileVfx = z.strictObject({
  recipe: z.literal("projectile"),
  head: z.strictObject({
    texture: ContentId,
    frame: z.number().int().nonnegative(),
    size: positive,
    spinHz: nonNegative,
    pulse: nonNegative,
    pulseHz: nonNegative,
    /** "build" (the owner's build colour) or a palette name, as for FxKind. */
    tint: ContentId,
  }),
  trail: z.strictObject({
    kind: ContentId,
    everyS: positive,
    size: positive,
    jitter: nonNegative,
    drift: nonNegative,
    /** Small build-coloured flames dropped with each trail puff (tier 3 bolts). */
    flame: z.strictObject({ kind: ContentId, scale: positive, lifeS: positive }).nullable(),
  }),
  /** A sound id in look/sounds.json played when this starts flying (must not loop). */
  sound: ContentId.nullable(),
});
export type ProjectileVfx = z.infer<typeof ProjectileVfx>;

/** A burst marked in ink: a shock ring sized from the burst radius, smoke, an optional shake. */
export const ExplosionVfx = z.strictObject({
  recipe: z.literal("explosion"),
  ring: z.strictObject({ kind: ContentId, scale: nonNegative }),
  smoke: z.strictObject({
    kind: ContentId,
    count: z.number().int().nonnegative(),
    size: positive,
    delayS: nonNegative,
    everyS: nonNegative,
  }),
  shake: ContentId.nullable(),
  /** A faint ground scorch left under the blast; its diameter is 2 × radius × scale. */
  scorch: z.strictObject({ kind: ContentId, scale: positive }).nullable(),
  /** A sound id in look/sounds.json played when the burst ends (must not loop). */
  sound: ContentId.nullable(),
});
export type ExplosionVfx = z.infer<typeof ExplosionVfx>;

const SizeRange = z.tuple([nonNegative, nonNegative]);

/**
 * A zone drawn as a burning field, for the zone's life: faint scorch stains, upright
 * burning-grass strips and small flames that catch as the spread reaches them (inner first),
 * and embers drifting up. No ground disc.
 */
export const GroundVfx = z.strictObject({
  recipe: z.literal("ground"),
  /** Size is a fraction of the zone radius; alpha multiplies the kind's alpha. */
  stains: z.strictObject({
    kind: ContentId,
    count: z.number().int().nonnegative(),
    alpha: unitInterval,
    size: SizeRange,
  }),
  /** Sizes in world units. */
  grass: z.strictObject({
    kind: ContentId,
    count: z.number().int().nonnegative(),
    size: SizeRange,
  }),
  flames: z.strictObject({
    kind: ContentId,
    count: z.number().int().nonnegative(),
    size: SizeRange,
  }),
  embers: z.strictObject({
    kind: ContentId,
    count: z.number().int().nonnegative(),
    size: positive,
  }),
  /** Seconds the fire takes to spread from the centre to the edge. */
  spreadS: nonNegative,
  /** The ground seen at a slant: y offsets inside the patch are squashed by this. */
  flat: z.number().positive().max(1),
  /** A sound id in look/sounds.json looped for the zone's whole life (must be tuned loop: true). */
  sound: ContentId.nullable(),
});
export type GroundVfx = z.infer<typeof GroundVfx>;

/**
 * An enemy's warned burst (a telegraph): ink hatching over a pale halo, then a ring on resolve.
 * Ink and halo colours are not fields: the view uses palette ink and parchment, never a build
 * colour, so a telegraph always reads over the player's effects.
 */
export const TelegraphVfx = z.strictObject({
  recipe: z.literal("telegraph"),
  /** Hatch lines: spacing and width in world units, angle in degrees. Ink by construction. */
  hatch: z.strictObject({
    spacing: positive,
    width: positive,
    angleDeg: z.number(),
    alpha: unitInterval,
  }),
  /** The pale halo that keeps the hatching readable over fire: a wide stroke under the outline. */
  halo: z.strictObject({ width: positive, alpha: unitInterval }),
  outline: z.strictObject({ width: positive, alpha: unitInterval }),
  /** The hatching grows from the centre (circle) or the start (lane) as the warning runs out. */
  fill: z.enum(["grow", "full"]),
  /** Ink stone lobbed from the owner to the mark during the warning; null = none. */
  lob: z.strictObject({ size: positive, arc: nonNegative }).nullable(),
  /**
   * On resolve: a ring of fx kind `kind` (an ink kind tinted white), its diameter
   * 2 × radius × scale (a lane's radius is its half-width), a shake key and a sound.
   */
  resolve: z.strictObject({
    kind: ContentId,
    scale: positive,
    shake: ContentId.nullable(),
    sound: ContentId.nullable(),
  }),
  /** A sound id in look/sounds.json played when the warning starts (must not loop). */
  sound: ContentId.nullable(),
});
export type TelegraphVfx = z.infer<typeof TelegraphVfx>;

export const Vfx = z.discriminatedUnion("recipe", [
  ProjectileVfx,
  ExplosionVfx,
  GroundVfx,
  TelegraphVfx,
  z.strictObject({ recipe: z.literal("none") }),
]);
export type Vfx = z.infer<typeof Vfx>;

export const LookFx = z.strictObject({
  $schema: SchemaRef,
  capacity: z.number().int().positive(),
  kinds: z.record(ContentId, FxKind),
  /** Keyed by the `vfx` names sim content uses. */
  vfx: z.record(ContentId, Vfx),
  hit: z.strictObject({ kind: ContentId, size: positive }),
  death: z.strictObject({
    splatter: ContentId,
    splatterSize: positive,
    puff: ContentId,
    puffSize: positive,
  }),
});
export type LookFx = z.infer<typeof LookFx>;
