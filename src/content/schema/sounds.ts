import { z } from "zod";
import { ContentId, SchemaRef } from "@/content/schema/vocab";

export const SoundTuning = z.strictObject({
  /** Copies that may play at once; requests past it are dropped. */
  cap: z.number().int().positive(),
  /** Seconds after a play before this sound may start again. */
  minGapS: z.number().nonnegative(),
  volume: z.number().min(0).max(1),
  /** Random pitch per play, ± semitones. */
  pitch: z.number().nonnegative().max(12),
  /** Whether this sound loops for a requested end time, e.g. a burning zone's life. */
  loop: z.boolean(),
});
export type SoundTuning = z.infer<typeof SoundTuning>;

/** How each sound plays; which event plays it is in look/fx.json and look/feedback.json. */
export const LookSounds = z.strictObject({
  $schema: SchemaRef,
  volume: z.number().min(0).max(1),
  sounds: z.record(ContentId, SoundTuning),
});
export type LookSounds = z.infer<typeof LookSounds>;

/** Written by `pnpm sounds`: each sound file under public/ and its length. */
export const SoundManifest = z.strictObject({
  $schema: SchemaRef,
  sounds: z.array(
    z.strictObject({ id: ContentId, file: z.string().min(1), lengthS: z.number().positive() }),
  ),
});
export type SoundManifest = z.infer<typeof SoundManifest>;
