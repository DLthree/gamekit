import type { Content } from "@/content/types";
import { createRng, type Rng } from "@/core/rng";
import { ActorAnims } from "@/realtime/present/anim/creatures";
import { type CameraState, createCamera } from "@/realtime/present/camera";
import type { Emitter } from "@/realtime/present/fx/emit";
import { FxPool } from "@/realtime/present/fx/pool";
import { ProjectileTracker } from "@/realtime/present/fx/trails";
import { SoundPlan } from "@/realtime/present/sound";
import { SpawnWarnings } from "@/realtime/present/spawn-warnings";
import { Telegraphs } from "@/realtime/present/telegraphs";

/** The presentation state for one running world. */
export interface Presentation {
  content: Content;
  em: Emitter;
  tracker: ProjectileTracker;
  warnings: SpawnWarnings;
  telegraphs: Telegraphs;
  anims: ActorAnims;
  camera: CameraState;
  sound: SoundPlan;
  shakeRng: Rng;
}

/** Separate streams from the scenario seed: e.g. whether audio is unlocked never changes fx. */
const SOUND_STREAM = 0x50_0d;
/** Shakes draw from their own stream, so fx variants don't shift between runs of the same shot. */
const SHAKE_STREAM = 0x5a_ce;

export function createPresentation(content: Content, seed: number): Presentation {
  const rng = createRng(seed);
  return {
    content,
    em: { pool: new FxPool(content.look.fx), rng, look: content.look },
    tracker: new ProjectileTracker(content.look),
    warnings: new SpawnWarnings(),
    telegraphs: new Telegraphs(),
    anims: new ActorAnims(rng, content.look.creatures.speedJitter),
    camera: createCamera(),
    sound: new SoundPlan(content.look, createRng(seed ^ SOUND_STREAM)),
    shakeRng: createRng(seed ^ SHAKE_STREAM),
  };
}

/**
 * A look-only edit: rebuilds everything the look built (effects pool, projectile tints,
 * per-actor jitter, the sound plan); the generators and the camera carry on. In-flight heads,
 * animation phases and ghosts reset, a few frames of visual reset for an otherwise live edit.
 */
export function swapPresentationLook(p: Presentation, content: Content): void {
  p.content = content;
  p.em = { pool: new FxPool(content.look.fx), rng: p.em.rng, look: content.look };
  p.tracker = new ProjectileTracker(content.look);
  p.anims = new ActorAnims(p.em.rng, content.look.creatures.speedJitter);
  p.sound.setLook(content.look);
}
