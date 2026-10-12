import { z } from "zod";
import { ContentId, SchemaRef, StatMod } from "@/content/schema/vocab";

/** Spawns per second ramping linearly from rate[0] to rate[1] over [from, to) seconds. */
export const RampSpawn = z.strictObject({
  enemy: ContentId,
  from: z.number().nonnegative(),
  to: z.number().positive(),
  rate: z.tuple([z.number().nonnegative(), z.number().nonnegative()]),
  pattern: z.literal("edge"),
});
export type RampSpawn = z.infer<typeof RampSpawn>;

/** `count` enemies at `at` seconds, off screen at spawnRadius: elites and bosses. */
const TimedSpawnEdge = z.strictObject({
  enemy: ContentId,
  at: z.number().nonnegative(),
  count: z.number().int().positive(),
  pattern: z.literal("edge"),
});

/** `count` enemies at `at` seconds, evenly spaced around the player at `radius`: an ambush. */
const TimedSpawnRing = z.strictObject({
  enemy: ContentId,
  at: z.number().nonnegative(),
  count: z.number().int().positive(),
  pattern: z.literal("ring"),
  radius: z.number().positive(),
});

/**
 * `count` enemies on screen around the player, each at a random angle and a random distance in
 * [minDistance, maxDistance]: the points are announced at `at` and the enemies appear there
 * `warnS` seconds later, so a wave opens with enemies in view without any spawning on the player.
 */
const TimedSpawnField = z.strictObject({
  enemy: ContentId,
  at: z.number().nonnegative(),
  count: z.number().int().positive(),
  pattern: z.literal("field"),
  minDistance: z.number().nonnegative(),
  maxDistance: z.number().positive(),
  warnS: z.number().nonnegative(),
});

export const TimedSpawn = z.union([TimedSpawnEdge, TimedSpawnRing, TimedSpawnField]);
export type TimedSpawn = z.infer<typeof TimedSpawn>;

export const SpawnEntry = z.union([RampSpawn, TimedSpawn]);
export type SpawnEntry = z.infer<typeof SpawnEntry>;

export const Threat = z.strictObject({
  $schema: SchemaRef,
  durationS: z.number().positive(),
  maxAlive: z.number().int().positive(),
  enemyMods: z.array(StatMod).default([]),
  spawns: z.array(SpawnEntry),
});
export type Threat = z.infer<typeof Threat>;
