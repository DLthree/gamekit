import type { z } from "zod";
import { Build } from "@/content/schema/build";
import { Character } from "@/content/schema/character";
import { Enemy } from "@/content/schema/enemy";
import {
  Camera,
  Controls,
  Feedback,
  Layers,
  LookCharacters,
  LookCreatures,
  Palette,
} from "@/content/schema/look";
import { LookFx } from "@/content/schema/look-fx";
import { Modifier } from "@/content/schema/modifier";
import { ArenaRules, FeelRules, LimitRules, MovementRules } from "@/content/schema/rules";
import { Skill } from "@/content/schema/skill";
import { LookSounds, SoundManifest } from "@/content/schema/sounds";
import { Sprites } from "@/content/schema/sprites";
import { Threat } from "@/content/schema/threat";

/** One content kind: a folder of files (collection) or a single file, and its schema. */
export interface Kind<T> {
  path: string;
  schemaName: string;
  schema: z.ZodType<T>;
  collection: boolean;
}

function kind<T>(
  path: string,
  schemaName: string,
  schema: z.ZodType<T>,
  collection: boolean,
): Kind<T> {
  return { path, schemaName, schema, collection };
}

export const KINDS = {
  characters: kind("characters", "character", Character, true),
  skills: kind("skills", "skill", Skill, true),
  modifiers: kind("modifiers", "modifier", Modifier, true),
  enemies: kind("enemies", "enemy", Enemy, true),
  builds: kind("builds", "build", Build, true),
  threats: kind("threats", "threat", Threat, true),
  arena: kind("rules/arena", "rules-arena", ArenaRules, false),
  movement: kind("rules/movement", "rules-movement", MovementRules, false),
  feel: kind("rules/feel", "rules-feel", FeelRules, false),
  limits: kind("rules/limits", "rules-limits", LimitRules, false),
  palette: kind("look/palette", "look-palette", Palette, false),
  lookCharacters: kind("look/characters", "look-characters", LookCharacters, false),
  creatures: kind("look/creatures", "look-creatures", LookCreatures, false),
  fx: kind("look/fx", "look-fx", LookFx, false),
  feedback: kind("look/feedback", "look-feedback", Feedback, false),
  camera: kind("look/camera", "look-camera", Camera, false),
  controls: kind("look/controls", "look-controls", Controls, false),
  layers: kind("look/layers", "look-layers", Layers, false),
  sprites: kind("look/generated/sprites", "look-generated-sprites", Sprites, false),
  sounds: kind("look/sounds", "look-sounds", LookSounds, false),
  soundManifest: kind("look/generated/sounds", "look-generated-sounds", SoundManifest, false),
};

/** The `$schema` a file must carry: relative from the file's folder to content/schema/. */
export function schemaRefFor(file: string, schemaName: string): string {
  const depth = file.split("/").length - 1;
  return `${"../".repeat(depth)}schema/${schemaName}.schema.json`;
}
