import type { z } from "zod";
import type { LookSounds, SoundManifest } from "@/content/schema/sounds";
import type { GAME_KINDS } from "@/game/content";
import type { Character } from "@/realtime/content/schema/character";
import type { Enemy } from "@/realtime/content/schema/enemy";
import type {
  Camera,
  Controls,
  Feedback,
  Layers,
  LookCharacters,
  LookCreatures,
  Palette,
} from "@/realtime/content/schema/look";
import type { LookFx } from "@/realtime/content/schema/look-fx";
import type { Modifier } from "@/realtime/content/schema/modifier";
import type {
  ArenaRules,
  FeelRules,
  LimitRules,
  MovementRules,
} from "@/realtime/content/schema/rules";
import type { Skill } from "@/realtime/content/schema/skill";
import type { Sprites } from "@/realtime/content/schema/sprites";
import type { Stage } from "@/realtime/content/schema/stage";

/** The game's collections (GAME_KINDS), keyed by id. */
export type GameSimContent = {
  [K in keyof typeof GAME_KINDS]: Record<string, z.infer<(typeof GAME_KINDS)[K]["schema"]>>;
};

/** What the sim reads. Collections are keyed by id (the file name). */
export interface SimContent extends GameSimContent {
  characters: Record<string, Character>;
  skills: Record<string, Skill>;
  modifiers: Record<string, Modifier>;
  enemies: Record<string, Enemy>;
  /** Benches (`?stage=<id>&dev=1`). */
  stages: Record<string, Stage>;
  rules: { arena: ArenaRules; movement: MovementRules; feel: FeelRules; limits: LimitRules };
}

/** Presentation only; the sim never reads it, so look edits never restart a wave. */
export interface LookContent {
  palette: Palette;
  characters: LookCharacters;
  creatures: LookCreatures;
  fx: LookFx;
  feedback: Feedback;
  camera: Camera;
  controls: Controls;
  layers: Layers;
  sprites: Sprites;
  sounds: LookSounds;
  soundManifest: SoundManifest;
}

/** One valid, deep-frozen content snapshot. */
export interface Content {
  sim: SimContent;
  look: LookContent;
}
