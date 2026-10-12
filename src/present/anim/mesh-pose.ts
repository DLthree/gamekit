import type { Content } from "@/content/types";
import { type ActorAnims, creatureOf, spriteOf } from "@/present/anim/creatures";
import {
  buildGrid,
  deformGrid,
  type MeshClock,
  type MeshGrid,
  meshPoint,
} from "@/present/anim/layer2";
import { bodyToWorld, newPropPose, propRest, staffThrust } from "@/present/anim/layer3";
import { type ActorDraw, type ActorInput, drawActor, newActorDraw } from "@/present/anim/pose";

/** A prop image this frame. */
export interface PropDraw {
  frame: string;
  originX: number;
  originY: number;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rot: number;
  depth: number;
}

/** A mesh creature this frame: the body transform (world units), its bent grid, its prop. */
export interface MeshDraw {
  def: string;
  body: ActorDraw;
  grid: MeshGrid;
  prop: PropDraw | null;
}

const clock: MeshClock = { t: 0, gaitHz: 1, breathHz: 1, walk: 0 };
const pp = newPropPose();
const hand = { x: 0, y: 0 };
const world = { x: 0, y: 0 };

export function newMeshDraw(content: Content, def: string): MeshDraw {
  const creature = creatureOf(content, def);
  if (creature.mesh === null)
    throw new Error(`${def} is not a mesh creature (look/creatures.json)`);
  const sprite = spriteOf(content, creature.sprite);
  const g = content.look.creatures.meshGrid;
  const grid = buildGrid(
    g.cols,
    g.rows,
    sprite.world[0],
    sprite.world[1],
    sprite.pivot[0],
    sprite.pivot[1],
  );
  const prop =
    creature.prop === null
      ? null
      : {
          frame: "",
          originX: 0.5,
          originY: 0.5,
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rot: 0,
          depth: 0,
        };
  return { def, body: newActorDraw(), grid, prop };
}

/**
 * A living mesh creature: layer-1 transform (as drawActor, but in world units because the grid
 * already is), the layer-2 bend on its animation clock, and the layer-3 prop at the bent hand,
 * thrusting for thrustS after a manual cast. The prop is rigid: it turns and mirrors with the
 * body but doesn't squash.
 */
export function drawMeshActor(
  content: Content,
  anims: ActorAnims,
  a: ActorInput,
  t: number,
  out: MeshDraw,
): MeshDraw {
  const creature = creatureOf(content, a.def);
  const mesh = creature.mesh;
  if (mesh === null) throw new Error(`${a.def} is not a mesh creature (look/creatures.json)`);
  const sprite = spriteOf(content, creature.sprite);
  const body = drawActor(content, anims, a, t, out.body);
  const k = sprite.world[0] / sprite.px[0];
  body.scaleX /= k;
  body.scaleY /= k;
  const s = anims.state(a.id);
  clock.t = t * s.rate + s.phase;
  clock.gaitHz = creature.gait.hz;
  clock.breathHz = creature.gait.breathHz;
  clock.walk = Math.min(1, Math.hypot(a.moveX, a.moveY));
  deformGrid(out.grid, mesh, clock);
  const prop = creature.prop;
  const pd = out.prop;
  if (prop === null || pd === null) return out;
  const u = (t - s.thrustAt) / prop.thrustS;
  if (u >= 0 && u <= 1) staffThrust(u, prop.restDeg, sprite.world[1], pp);
  else propRest(prop.restDeg, clock.t, pp);
  meshPoint(prop.hand[0], prop.hand[1], out.grid, mesh, clock, hand);
  bodyToWorld(body, hand.x + pp.dx, hand.y + pp.dy, world);
  const ps = spriteOf(content, prop.sprite);
  const kp = (ps.world[0] / ps.px[0]) * prop.scale;
  pd.frame = ps.frame;
  pd.originX = ps.pivot[0];
  pd.originY = ps.pivot[1];
  pd.x = world.x;
  pd.y = world.y;
  pd.scaleX = kp * a.facing;
  pd.scaleY = kp;
  pd.rot = body.rot + pp.angle * a.facing;
  // In front of the body; depth only orders, so a hundredth of a unit is enough.
  pd.depth = body.depth + 0.01;
  return out;
}
