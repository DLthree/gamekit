import { TICK_S } from "@/core/clock";
import { clampLength, unit, type Vec } from "@/core/vec";
import type { Actor } from "@/sim/actors/store";
import { nearestEnemy } from "@/sim/combat/targeting";
import type { CastCommand, Command } from "@/sim/command";
import type { Volume } from "@/sim/volumes/store";
import { playerOf, type World } from "@/sim/world";

const LOOP_RADIUS = 90;
const LOOP_S = 14;
const CELL = 80;
const AIM_RANGE = 320;
/** Telegraphs push the bot while it is within their radius plus this margin. */
const DODGE_MARGIN = 40;
/** Warned field spawns push the bot while it is within this distance of the point. */
const PENDING_RANGE = 60;
/**
 * A push's strength at the shape, fading to 0 at the margin: strong enough to beat the loop's
 * pull (≤ 1) until the body clears the edge.
 */
const PUSH = 6;

/** The centroid of the most crowded CELL-sized grid cell of enemies within `range`, or null. */
function densest(world: World, p: Actor, range: number): Vec | null {
  const cells = new Map<string, { n: number; x: number; y: number }>();
  let best: { n: number; x: number; y: number } | null = null;
  for (const a of world.actors.items) {
    if (!a.alive || a.hp <= 0 || a.team !== "enemy") continue;
    if (Math.hypot(a.x - p.x, a.y - p.y) > range) continue;
    const key = `${Math.floor(a.x / CELL)},${Math.floor(a.y / CELL)}`;
    const c = cells.get(key) ?? { n: 0, x: 0, y: 0 };
    c.n += 1;
    c.x += a.x;
    c.y += a.y;
    cells.set(key, c);
    if (best === null || c.n > best.n) best = c;
  }
  return best === null ? null : { x: best.x / best.n, y: best.y / best.n };
}

function castFor(world: World, p: Actor): CastCommand | null {
  const inst = p.skills.find((s) => s.skill.def.activation === "manual");
  if (inst === undefined || inst.slot === null || world.tick < inst.readyTick) return null;
  const target = inst.skill.tags.includes("area")
    ? densest(world, p, AIM_RANGE)
    : nearestEnemy(world, p.x, p.y, AIM_RANGE);
  return target === null
    ? null
    : { slot: inst.slot, aim: { x: target.x - p.x, y: target.y - p.y } };
}

/** The point of a volume's shape nearest (px, py): a lane's spine, else its centre. */
function nearestPoint(v: Volume, px: number, py: number): Vec {
  if (v.shape !== "lane") return { x: v.x, y: v.y };
  const s = Math.min(v.length, Math.max(0, (px - v.x) * v.dirX + (py - v.y) * v.dirY));
  return { x: v.x + v.dirX * s, y: v.y + v.dirY * s };
}

/** Adds to `acc` a push away from (qx, qy), fading from PUSH at the point to 0 at `reach`. */
function push(acc: Vec, p: Actor, qx: number, qy: number, reach: number, along: Vec): void {
  const d = Math.hypot(p.x - qx, p.y - qy);
  if (d >= reach) return;
  const u = unit(p.x - qx, p.y - qy, along);
  const w = PUSH * (1 - d / reach);
  acc.x += u.x * w;
  acc.y += u.y * w;
}

/**
 * Away from every enemy warning still warning and every warned spawn point nearby. Standing on
 * a shape's exact centre has no away, so the push then continues the loop (`along`).
 */
function dodge(world: World, p: Actor, along: Vec): Vec {
  const acc = { x: 0, y: 0 };
  for (const v of world.volumes.items) {
    if (!v.alive || v.team !== "enemy" || world.tick >= v.bornTick + v.warnTicks) continue;
    const q = nearestPoint(v, p.x, p.y);
    push(acc, p, q.x, q.y, v.radius + DODGE_MARGIN, along);
  }
  for (const s of world.wave.pending) push(acc, p, s.x, s.y, PENDING_RANGE, along);
  return acc;
}

/**
 * The one test bot: a slow loop around the centre that steps out of telegraphs and warned spawn
 * points, casting where it hurts most. Read-only.
 */
export function kite(world: World): Command {
  const p = playerOf(world);
  const a = ((world.tick * TICK_S) / LOOP_S) * Math.PI * 2;
  const away = dodge(world, p, { x: -Math.sin(a), y: Math.cos(a) });
  const loop = clampLength(
    (Math.cos(a) * LOOP_RADIUS - p.x) / 20,
    (Math.sin(a) * LOOP_RADIUS - p.y) / 20,
    1,
  );
  const m = clampLength(loop.x + away.x, loop.y + away.y, 1);
  return { moveX: m.x, moveY: m.y, cast: castFor(world, p) };
}
