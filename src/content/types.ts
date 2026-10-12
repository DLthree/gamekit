import type { z } from "zod";
import type { Character } from "@/content/schema/character";
import type { Enemy } from "@/content/schema/enemy";
import type {
  Camera,
  Controls,
  Feedback,
  Layers,
  LookCharacters,
  LookCreatures,
  Palette,
} from "@/content/schema/look";
import type { LookFx } from "@/content/schema/look-fx";
import type { Modifier } from "@/content/schema/modifier";
import type { ArenaRules, FeelRules, LimitRules, MovementRules } from "@/content/schema/rules";
import type { Skill } from "@/content/schema/skill";
import type { LookSounds, SoundManifest } from "@/content/schema/sounds";
import type { Sprites } from "@/content/schema/sprites";
import type { Stage } from "@/content/schema/stage";
import type { GAME_KINDS } from "@/game/content";

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
