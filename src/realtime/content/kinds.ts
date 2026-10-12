import { kind } from "@/content/kind";
import { Character } from "@/realtime/content/schema/character";
import { Enemy } from "@/realtime/content/schema/enemy";
import {
  Camera,
  Controls,
  Feedback,
  Layers,
  LookCharacters,
  LookCreatures,
  Palette,
} from "@/realtime/content/schema/look";
import { LookFx } from "@/realtime/content/schema/look-fx";
import { Modifier } from "@/realtime/content/schema/modifier";
import { ArenaRules, FeelRules, LimitRules, MovementRules } from "@/realtime/content/schema/rules";
import { Skill } from "@/realtime/content/schema/skill";
import { Sprites } from "@/realtime/content/schema/sprites";
import { Stage } from "@/realtime/content/schema/stage";

/**
 * The content the real-time layer reads: the sim's (characters, skills, modifiers, enemies,
 * stages, rules) and the presentation's (look). A real-time game spreads these into its
 * `GAME_KINDS` (src/game/content.ts).
 */
export const REALTIME_KINDS = {
  sim: {
    characters: kind("characters", "character", Character, true),
    skills: kind("skills", "skill", Skill, true),
    modifiers: kind("modifiers", "modifier", Modifier, true),
    enemies: kind("enemies", "enemy", Enemy, true),
    /** Benches (`?stage=<id>&dev=1`). */
    stages: kind("stages", "stage", Stage, true),
    rules: {
      arena: kind("rules/arena", "rules-arena", ArenaRules, false),
      movement: kind("rules/movement", "rules-movement", MovementRules, false),
      feel: kind("rules/feel", "rules-feel", FeelRules, false),
      limits: kind("rules/limits", "rules-limits", LimitRules, false),
    },
  },
  look: {
    palette: kind("look/palette", "look-palette", Palette, false),
    characters: kind("look/characters", "look-characters", LookCharacters, false),
    creatures: kind("look/creatures", "look-creatures", LookCreatures, false),
    fx: kind("look/fx", "look-fx", LookFx, false),
    feedback: kind("look/feedback", "look-feedback", Feedback, false),
    camera: kind("look/camera", "look-camera", Camera, false),
    controls: kind("look/controls", "look-controls", Controls, false),
    layers: kind("look/layers", "look-layers", Layers, false),
    sprites: kind("look/generated/sprites", "look-generated-sprites", Sprites, false),
  },
};
