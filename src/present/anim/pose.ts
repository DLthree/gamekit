import type { Content } from "@/content/types";
import type { Id } from "@/core/ids";
import { type ActorAnims, creatureOf, type Ghost, spriteOf } from "@/present/anim/creatures";
import {
  applyLunge,
  applyRecoil,
  applySpring,
  bodyPose,
  deathLook,
  isFlashing,
  newDeathLook,
  newPose,
  type Pose,
  spring,
} from "@/present/anim/layer1";
import { depthFor } from "@/present/layers";

/** A creature's body transform, flash and shadow this frame (its grid bends the image). */
export interface ActorDraw {
  visible: boolean;
  frame: string;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rot: number;
  alpha: number;
  flash: boolean;
  depth: number;
  shadowX: number;
  shadowY: number;
  shadowW: number;
  shadowH: number;
  shadowAlpha: number;
}

export function newActorDraw(): ActorDraw {
  return {
    visible: false,
    frame: "",
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rot: 0,
    alpha: 1,
    flash: false,
    depth: 0,
    shadowX: 0,
    shadowY: 0,
    shadowW: 0,
    shadowH: 0,
    shadowAlpha: 0,
  };
}

export interface ActorInput {
  id: Id;
  def: string;
  x: number;
  y: number;
  facing: 1 | -1;
  moveX: number;
  moveY: number;
  isPlayer: boolean;
}

const pose = newPose();
const death = newDeathLook();

function base(content: Content, def: string, x: number, y: number, out: ActorDraw) {
  const creature = creatureOf(content, def);
  const sprite = spriteOf(content, creature.sprite);
  const shadow = content.look.feedback.shadow;
  out.visible = true;
  out.frame = sprite.frame;
  out.shadowX = x;
  out.shadowY = y;
  out.shadowW = sprite.world[0] * shadow.width * (sprite.flying ? 0.6 : 1);
  out.shadowH = out.shadowW * shadow.height * 2;
  out.shadowAlpha = shadow.alpha * (sprite.flying ? 0.7 : 1);
  return { creature, sprite, k: sprite.world[0] / sprite.px[0] };
}

/**
 * A living actor's layer-1 pose: gait, the hit spring and recoil, and on casts the player's
 * stretch and recoil away from the aim (enemies lunge instead). Returns the body height.
 */
export function actorPose(
  content: Content,
  anims: ActorAnims,
  a: ActorInput,
  t: number,
  out: Pose,
): number {
  const creature = creatureOf(content, a.def);
  const h = spriteOf(content, creature.sprite).world[1];
  const fb = content.look.feedback;
  const s = anims.state(a.id);
  s.facing = a.facing;
  bodyPose(creature.gait, h, t * s.rate + s.phase, Math.min(1, Math.hypot(a.moveX, a.moveY)), out);
  const hit = t - s.hitAt;
  applySpring(spring(hit, fb.hitSpring), out);
  applyRecoil(hit, h, fb.hitRecoil, -1, 0, out);
  const cast = t - s.castAt;
  if (a.isPlayer) {
    applySpring(-spring(cast, fb.castSpring), out);
    // The creature frame's +x is the facing; the aim is in world axes.
    applyRecoil(cast, h, fb.castRecoil, -s.castX * a.facing, -s.castY, out);
  } else {
    applyLunge(cast, h, fb.lunge, out);
  }
  return h;
}

/** A living actor: layer-1 pose, flash, y-sorted depth; scaled from image px to world units. */
export function drawActor(
  content: Content,
  anims: ActorAnims,
  a: ActorInput,
  t: number,
  out: ActorDraw,
): ActorDraw {
  const { k } = base(content, a.def, a.x, a.y, out);
  actorPose(content, anims, a, t, pose);
  const s = anims.state(a.id);
  out.x = a.x + pose.dx * a.facing;
  out.y = a.y + pose.dy;
  out.scaleX = k * pose.sx * a.facing;
  out.scaleY = k * pose.sy;
  out.rot = pose.rot * a.facing;
  out.alpha = 1;
  out.flash = isFlashing(t - s.hitAt, content.look.feedback.hitFlash.durationS);
  out.depth = depthFor(content.look.layers, a.isPlayer ? "player" : "actors", a.y);
  return out;
}

/** A death ghost: pop, flash, spin, fade. */
export function drawGhost(content: Content, g: Ghost, t: number, out: ActorDraw): ActorDraw {
  const { k } = base(content, g.def, g.x, g.y, out);
  const d = deathLook(t - g.at, content.look.feedback.death, death);
  out.visible = d.visible;
  out.x = g.x;
  out.y = g.y;
  out.scaleX = k * d.scale * g.facing;
  out.scaleY = k * d.scale;
  out.rot = d.spin * g.facing;
  out.alpha = d.alpha;
  out.flash = d.flash;
  out.shadowAlpha *= d.alpha;
  out.depth = depthFor(content.look.layers, "actors", g.y);
  return out;
}
