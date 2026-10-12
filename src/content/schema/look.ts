import { z } from "zod";
import { ArtRole } from "@/content/schema/sprites";
import { ContentId, Role, SchemaRef } from "@/content/schema/vocab";

const positive = z.number().positive();
const nonNegative = z.number().nonnegative();
const unitInterval = z.number().min(0).max(1);

/** Named colours; recipes and looks refer to colours by name, never by hex. */
export const Palette = z.strictObject({
  $schema: SchemaRef,
  colors: z.record(ContentId, z.string().regex(/^#[0-9a-f]{6}$/, "colours are #rrggbb, lowercase")),
});
export type Palette = z.infer<typeof Palette>;

/** Per character: which creature profile draws it and its build colour (a palette name). */
export const LookCharacters = z.strictObject({
  $schema: SchemaRef,
  characters: z.record(ContentId, z.strictObject({ creature: ContentId, buildColor: ContentId })),
});
export type LookCharacters = z.infer<typeof LookCharacters>;

/** Layer-1 whole-sprite motion: amplitudes are fractions of body height or degrees. */
export const Gait = z.strictObject({
  kind: z.enum(["waddle", "hop", "slide", "flap"]),
  hz: positive,
  bob: nonNegative,
  squash: nonNegative,
  rock: nonNegative,
  lean: z.number(),
  breath: nonNegative,
  breathHz: positive,
  hover: nonNegative,
});
export type Gait = z.infer<typeof Gait>;

/**
 * Layer-2 bend amounts: fractions of body height (lean, sway, stride, breath) and
 * width (spread); `hip` is where the legs start, as a fraction of the image height.
 */
export const MeshBend = z.strictObject({
  lean: z.number(),
  sway: nonNegative,
  stride: nonNegative,
  spread: nonNegative,
  breath: nonNegative,
  hip: z.number().gt(0.1).lt(1),
});
export type MeshBend = z.infer<typeof MeshBend>;

const Unit2 = z.tuple([unitInterval, unitInterval]);

/** Layer-3 prop held at the bent hand: the wizard's staff. */
export const Prop = z.strictObject({
  sprite: ContentId,
  /** The hand in the body image (0..1), where the prop's grip sits. */
  hand: Unit2,
  restDeg: z.number(),
  scale: positive,
  /** Seconds of the thrust on each manual cast. */
  thrustS: positive,
});
export type Prop = z.infer<typeof Prop>;

export const Creature = z.strictObject({
  sprite: ContentId,
  gait: Gait,
  /** Layer-2 bend, drawn as a Mesh2D; null draws a flat image. Player creatures only. */
  mesh: MeshBend.nullable(),
  prop: Prop.nullable(),
});
export type Creature = z.infer<typeof Creature>;

export const LookCreatures = z.strictObject({
  $schema: SchemaRef,
  /** Per-instance animation speed spread (±), so a horde never moves in lockstep. */
  speedJitter: unitInterval,
  /** Cells of the layer-2 grid across and down the image (4 × 6). */
  meshGrid: z.strictObject({ cols: z.number().int().min(1), rows: z.number().int().min(1) }),
  /** Art roles drawn with the mesh bend; the rest stay flat, so a crowd costs one image each. */
  meshRoles: z.array(ArtRole).min(1),
  creatures: z.record(ContentId, Creature),
});
export type LookCreatures = z.infer<typeof LookCreatures>;

/** A damped spring: `amount` at the event, ringing at hz, decaying with decayS. */
const Spring = z.strictObject({ amount: nonNegative, hz: positive, decayS: positive });
/** A shove of `distance` × body height that eases back with decayS. */
const Recoil = z.strictObject({ distance: nonNegative, decayS: positive });

export const Feedback = z.strictObject({
  $schema: SchemaRef,
  hitFlash: z.strictObject({ durationS: positive, color: ContentId }),
  hitSpring: Spring,
  hitRecoil: Recoil,
  /** The player on each cast: a stretch spring and a recoil away from the aim. */
  castSpring: Spring,
  castRecoil: Recoil,
  /** Per target: hit flash, ink and sound at most once per this many seconds. */
  hitLimitS: nonNegative,
  lunge: z.strictObject({ durationS: positive, reach: nonNegative, leanDeg: nonNegative }),
  death: z.strictObject({ durationS: positive, pop: nonNegative, spinDeg: z.number() }),
  shadow: z.strictObject({ alpha: unitInterval, width: positive, height: positive }),
  /** Named shakes; intensity is a fraction of the visible world width (Phaser's convention). */
  shake: z.record(ContentId, z.strictObject({ durationS: positive, intensity: nonNegative })),
  playerHurtShake: ContentId,
  /** Enemy roles whose death is big: gold flakes, bigDeathShake and the bigDeath sound. */
  bigDeathRoles: z.array(Role),
  /** The shake when a bigDeathRoles enemy dies. */
  bigDeathShake: ContentId,
  /** Sound ids (look/sounds.json) for these events; volume events are in look/fx.json. */
  sounds: z.strictObject({
    hit: ContentId,
    death: ContentId,
    playerHurt: ContentId,
    cast: ContentId,
    /** Played on top of `death` when a bigDeathRoles enemy dies. */
    bigDeath: ContentId,
  }),
  /**
   * Flakes of fx `kind` shed when a bigDeathRoles enemy dies (gold only ever leaves gold art):
   * `count` flakes of `size` world units, popping up at up to `pop` world units a second.
   */
  goldFlakes: z.strictObject({
    kind: ContentId,
    count: z.number().int().positive(),
    size: positive,
    pop: positive,
  }),
  /**
   * A field spawn's marker: a ring `scale` × half the enemy's body height, pulsing by `pulse`
   * (a fraction of its radius) at `pulseHz`, filling from its centre over the warning.
   */
  spawnWarning: z.strictObject({
    color: ContentId,
    alpha: unitInterval,
    fillAlpha: unitInterval,
    width: positive,
    scale: positive,
    pulse: nonNegative,
    pulseHz: nonNegative,
  }),
});
export type Feedback = z.infer<typeof Feedback>;
export type SpawnWarningLook = Feedback["spawnWarning"];

export const Camera = z.strictObject({
  $schema: SchemaRef,
  /** World units across the screen's short side, in portrait and landscape. */
  shortSideSpan: positive,
  /** Widest supported long/short screen ratio; the content check keeps spawns off screen at it. */
  maxAspect: z.number().min(1),
  dprCap: z.number().min(1),
  /** The camera centres this far below the player's feet (world units; -20 centres the body). */
  focusOffsetY: z.number(),
  /** World units the camera drifts toward the move direction (SNKRX); 0 turns it off. */
  lead: nonNegative,
  /** Seconds for the lead to ease most of the way to a new direction. */
  leadSmoothS: positive,
  background: ContentId,
  clearing: z.strictObject({
    width: positive,
    height: positive,
    alpha: unitInterval,
    color: ContentId,
  }),
  edge: z.strictObject({ color: ContentId, width: positive, alpha: unitInterval }),
  /** Ink specks and grass tufts per 10,000 square world units, so camera motion reads. */
  floor: z.strictObject({ density: nonNegative, alpha: unitInterval, color: ContentId }),
});
export type Camera = z.infer<typeof Camera>;

export const Controls = z.strictObject({
  $schema: SchemaRef,
  stickRadius: positive,
  stickDeadZone: nonNegative,
  /** The skill button's radius in CSS px. */
  buttonRadius: positive,
  /** The skill knob and stick knob radius in CSS px. */
  knobRadius: positive,
  /** The skill button's ring colour while a release would cancel (dragged out, then back on). */
  cancelColor: ContentId,
  /** The aim indicator: a line to the skill's range and a ring of its area, in ink. */
  aim: z.strictObject({
    color: ContentId,
    /** Stroke colour while the cast skill is on cooldown, so a release then reads as dropped. */
    cooldownColor: ContentId,
    alpha: unitInterval,
    width: positive,
  }),
});
export type Controls = z.infer<typeof Controls>;

export const BANDS = [
  "floor",
  "ground",
  "blast",
  "clearing",
  "shadows",
  "actors",
  "fx",
  "telegraphs",
  "player",
  "aim",
] as const;
export const Band = z.enum(BANDS);
export type Band = z.infer<typeof Band>;

/** Draw order bottom → top; bands in ySorted add the feet y to their depth. */
export const Layers = z.strictObject({
  $schema: SchemaRef,
  bands: z.array(Band).min(1),
  ySorted: z.array(Band),
});
export type Layers = z.infer<typeof Layers>;
