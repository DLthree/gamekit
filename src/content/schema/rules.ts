import { z } from "zod";
import { SchemaRef } from "@/content/schema/vocab";

const positive = z.number().positive();
const nonNegative = z.number().nonnegative();
const count = z.number().int().positive();

/** Arena half extents; enemies spawn `spawnRadius` from the player (off screen on every screen). */
export const ArenaRules = z.strictObject({
  $schema: SchemaRef,
  halfWidth: positive,
  halfHeight: positive,
  spawnRadius: positive,
});
export type ArenaRules = z.infer<typeof ArenaRules>;

export const MovementRules = z.strictObject({
  $schema: SchemaRef,
  separationRadius: positive,
  separationStrength: nonNegative,
  /** Knockback velocity decays by exp(-knockbackDamping · t). */
  knockbackDamping: positive,
  /** Horizontal speed (units/s) below which an actor keeps its facing. */
  facingDeadZone: nonNegative,
});
export type MovementRules = z.infer<typeof MovementRules>;

export const FeelRules = z.strictObject({
  $schema: SchemaRef,
  hitStopS: nonNegative,
  countdownS: nonNegative,
});
export type FeelRules = z.infer<typeof FeelRules>;

export const LimitRules = z.strictObject({
  $schema: SchemaRef,
  actors: count,
  volumes: count,
  events: count,
  hits: count,
  hashCellSize: positive,
});
export type LimitRules = z.infer<typeof LimitRules>;
