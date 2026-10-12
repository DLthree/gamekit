import type { Content } from "@/content/types";
import { type ActorAnims, creatureOf, type Ghost, spriteOf } from "@/present/anim/creatures";
import {
  buildGrid,
  deformGrid,
  type MeshClock,
  type MeshGrid,
  meshPoint,
} from "@/present/anim/layer2";
import { bodyToWorld, newPropPose, propRest, staffThrust } from "@/present/anim/layer3";
import {
  type ActorDraw,
  type ActorInput,
  drawActor,
  drawGhost,
  newActorDraw,
} from "@/present/anim/pose";

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

/**
 * A creature this frame: the body transform (world units), its bent grid, its prop. Every
 * creature is one still image on a grid; all its motion is this transform and the bend.
 */
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
 * A living creature: layer-1 transform (as drawActor, but in world units because the grid
 * already is), the layer-2 bend on its animation clock (idle breath blending into the walk
 * stride by its speed), and the layer-3 prop at the bent hand, thrusting for thrustS after a
 * manual cast. The prop is rigid: it turns and mirrors with the body but doesn't squash.
 */
export function drawMeshActor(
  content: Content,
  anims: ActorAnims,
  a: ActorInput,
  t: number,
  out: MeshDraw,
): MeshDraw {
  drawActor(content, anims, a, t, out.body);
  const s = anims.state(a.id);
  const walk = Math.min(1, Math.hypot(a.moveX, a.moveY));
  return bend(content, a.def, t * s.rate + s.phase, walk, t - s.thrustAt, a.facing, false, out);
}

/**
 * A dead creature's death pop (drawGhost: swell, flash, spin, fade), its grid held at rest as
 * it was when it fell and its prop going with it.
 */
export function drawMeshGhost(content: Content, g: Ghost, t: number, out: MeshDraw): MeshDraw {
  drawGhost(content, g, t, out.body);
  return bend(content, g.def, g.at, 0, Number.POSITIVE_INFINITY, g.facing, true, out);
}

/**
 * Scales `out.body` from image px to the grid's world units, bends the grid on clock `clockT`
 * at `walk`, and poses the prop `sinceThrust` seconds after its last thrust. A living body's
 * prop stays rigid through its squash; a dying one's (`popping`) swells and shrinks with it.
 */
function bend(
  content: Content,
  def: string,
  clockT: number,
  walk: number,
  sinceThrust: number,
  facing: 1 | -1,
  popping: boolean,
  out: MeshDraw,
): MeshDraw {
  const creature = creatureOf(content, def);
  const mesh = creature.mesh;
  const sprite = spriteOf(content, creature.sprite);
  const body = out.body;
  const k = sprite.world[0] / sprite.px[0];
  body.scaleX /= k;
  body.scaleY /= k;
  clock.t = clockT;
  clock.gaitHz = creature.gait.hz;
  clock.breathHz = creature.gait.breathHz;
  clock.walk = walk;
  deformGrid(out.grid, mesh, clock);
  const prop = creature.prop;
  const pd = out.prop;
  if (prop === null || pd === null) return out;
  const u = sinceThrust / prop.thrustS;
  if (u >= 0 && u <= 1) staffThrust(u, prop.restDeg, sprite.world[1], pp);
  else propRest(prop.restDeg, clock.t, pp);
  meshPoint(prop.hand[0], prop.hand[1], out.grid, mesh, clock, hand);
  bodyToWorld(body, hand.x + pp.dx, hand.y + pp.dy, world);
  const ps = spriteOf(content, prop.sprite);
  const kp = (ps.world[0] / ps.px[0]) * prop.scale * (popping ? body.scaleY : 1);
  pd.frame = ps.frame;
  pd.originX = ps.pivot[0];
  pd.originY = ps.pivot[1];
  pd.x = world.x;
  pd.y = world.y;
  pd.scaleX = kp * facing;
  pd.scaleY = kp;
  pd.rot = body.rot + pp.angle * facing;
  // In front of the body; depth only orders, so a hundredth of a unit is enough.
  pd.depth = body.depth + 0.01;
  return out;
}
