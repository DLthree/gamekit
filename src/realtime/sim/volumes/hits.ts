import { ticks } from "@/core/clock";
import { nextFloat } from "@/core/rng";
import type { Actor } from "@/realtime/sim/actors/store";
import { resolveHit } from "@/realtime/sim/combat/damage";
import { inArc, inCircle, inLane } from "@/realtime/sim/combat/shapes";
import { isWarning, MAX_HITS, type Volume } from "@/realtime/sim/volumes/store";
import type { World } from "@/realtime/sim/world";

function isTarget(v: Volume, a: Actor): boolean {
  return a.alive && a.hp > 0 && a.team !== v.team;
}

function pushHit(world: World, v: Volume, a: Actor): void {
  const h = world.hits;
  if (h.count >= h.volume.length) {
    throw new Error(
      `tick ${world.tick}: hit buffer overflowed rules/limits.json › hits (${h.volume.length})`,
    );
  }
  h.volume[h.count] = v.slot;
  h.actor[h.count] = a.slot;
  h.count += 1;
}

function touches(v: Volume, a: Actor): boolean {
  switch (v.shape) {
    case "circle":
      return inCircle(v.x, v.y, v.radius, a.x, a.y, a.radius);
    case "arc":
      return inArc(v.x, v.y, v.radius, v.dirX, v.dirY, v.halfAngle, a.x, a.y, a.radius);
    case "lane":
      return inLane(v.x, v.y, v.dirX, v.dirY, v.length, v.radius, a.x, a.y, a.radius);
  }
}

/** Every body a sweeping volume's shape touches, once each; returns whether the player was one. */
function sweep(world: World, v: Volume, n: number): boolean {
  const items = world.actors.items;
  let hitPlayer = false;
  for (let k = 0; k < n; k++) {
    const a = items[world.scratch[k]];
    if (!isTarget(v, a) || !touches(v, a)) continue;
    pushHit(world, v, a);
    if (a.id === world.playerId) hitPlayer = true;
  }
  return hitPlayer;
}

function wasHit(v: Volume, id: number): boolean {
  for (let i = 0; i < v.hitCount; i++) if (v.hitIds[i] === id) return true;
  return false;
}

/**
 * A projectile's contacts, nearest first: each is hit once (impact "damage") until hitsLeft runs
 * out, then it ends. A trigger projectile ends on its first contact and its onEnd does the rest.
 */
function projectileHits(world: World, v: Volume, n: number): void {
  const items = world.actors.items;
  while (v.hitsLeft > 0) {
    let best: Actor | null = null;
    let bestD2 = Number.POSITIVE_INFINITY;
    for (let k = 0; k < n; k++) {
      const a = items[world.scratch[k]];
      if (!isTarget(v, a) || wasHit(v, a.id)) continue;
      if (!inCircle(v.x, v.y, v.radius, a.x, a.y, a.radius)) continue;
      const d2 = (a.x - v.x) ** 2 + (a.y - v.y) ** 2;
      if (d2 < bestD2) {
        best = a;
        bestD2 = d2;
      }
    }
    if (best === null) return;
    if (v.node.do === "projectile" && v.node.impact === "trigger") {
      v.ended = true;
      return;
    }
    if (v.hitCount >= MAX_HITS) throw new Error(`volume ${v.id} hit more than ${MAX_HITS} bodies`);
    pushHit(world, v, best);
    v.hitIds[v.hitCount++] = best.id;
    v.hitsLeft -= 1;
  }
  v.ended = true;
}

/**
 * Phase 6: projectiles find their contact; bursts sweep once (on the first tick they aren't
 * warning) and end; zones sweep on each pulse tick. A projectile that reached its range this tick
 * is already `ended` (moveVolumes) but still gets its final-position contact test; an ended zone
 * does not pulse again. A warning or cancelled volume is skipped: it never hurts.
 */
export function collectHits(world: World): void {
  const { hash, scratch, maxRadius } = world;
  for (const v of world.volumes.items) {
    if (!v.alive || v.cancelled || isWarning(v, world.tick)) continue;
    if (v.kind === "zone") {
      if (v.ended || world.tick < v.nextPulseTick) continue;
      v.nextPulseTick += v.pulseTicks;
    }
    // A lane is queried by the circle around its midpoint that holds the whole capsule.
    const half = v.length / 2;
    const n = hash.queryCircle(
      v.x + v.dirX * half,
      v.y + v.dirY * half,
      half + v.radius + maxRadius,
      scratch,
    );
    if (v.kind === "projectile") projectileHits(world, v, n);
    else {
      const hitPlayer = sweep(world, v, n);
      if (v.kind === "burst") {
        v.hitPlayer = hitPlayer;
        v.ended = true;
      }
    }
  }
}

/** Phase 7: packets land. Damage, knockback, deaths (one event each), hit-stop. */
export function applyHits(world: World): void {
  const { hits, events, tick } = world;
  const hitStop = ticks(world.content.rules.feel.hitStopS);
  for (let i = 0; i < hits.count; i++) {
    const v = world.volumes.items[hits.volume[i]];
    const a = world.actors.items[hits.actor[i]];
    if (a.hp <= 0) continue;
    const r = resolveHit(
      {
        source: v.id,
        owner: v.owner,
        ownerDef: v.ownerDef,
        skill: v.skill.id,
        tags: v.skill.tags,
        amounts: v.damage,
        knockback: v.knockback,
        originX: v.x,
        originY: v.y,
        dirX: v.dirX,
        dirY: v.dirY,
      },
      a,
    );
    // On a stage the player's life never drops below 1: a bench runs its whole duration.
    const floor = a.team === "player" && world.stage !== null ? 1 : 0;
    a.hp = Math.max(floor, a.hp - r.damage);
    const killed = r.killed && a.hp <= 0;
    a.vx += r.kx;
    a.vy += r.ky;
    events.push({
      t: "hit",
      tick,
      target: a.id,
      targetDef: a.def,
      team: a.team,
      source: v.id,
      skill: v.skill.id,
      amount: r.damage,
      x: a.x,
      y: a.y,
      kx: r.kx,
      ky: r.ky,
    });
    if (a.team === "player") {
      events.push({ t: "playerHurt", tick, amount: r.damage, hp: a.hp, by: v.ownerDef });
    }
    if (killed) {
      events.push({
        t: "died",
        tick,
        id: a.id,
        def: a.def,
        role: a.role,
        x: a.x,
        y: a.y,
        killer: v.ownerDef,
        skill: v.skill.id,
      });
    }
    if (v.hitStop) world.freezeTicks = Math.max(world.freezeTicks, hitStop);
  }
  hits.count = 0;
}

/**
 * Phase 7 (end): ended volumes say so and queue their onEnd children for the next tick, targeted
 * at where the parent ended; a child with a `chance` rolls the world RNG each time and is queued
 * only on success. An enemy's warned burst first says whether the player stayed in it. A
 * cancelled volume only says it ended: it never swept, so it has no resolve and no children.
 */
export function endVolumes(world: World): void {
  for (const v of world.volumes.items) {
    if (!v.alive || !v.ended) continue;
    if (!v.cancelled && v.warnTicks > 0 && v.team === "enemy") {
      world.events.push({
        t: "telegraphResolved",
        tick: world.tick,
        id: v.id,
        vfx: v.vfx,
        ownerDef: v.ownerDef,
        x: v.x,
        y: v.y,
        r: v.radius,
        hitPlayer: v.hitPlayer,
      });
    }
    world.events.push({
      t: "volumeEnded",
      tick: world.tick,
      id: v.id,
      kind: v.kind,
      vfx: v.vfx,
      team: v.team,
      ownerDef: v.ownerDef,
      x: v.x,
      y: v.y,
      r: v.radius,
      cancelled: v.cancelled,
    });
    if (v.cancelled) continue;
    for (const node of v.node.onEnd) {
      if (node.chance !== undefined && nextFloat(world.rng) >= node.chance) continue;
      world.deliveries.push({
        skill: v.skill,
        node,
        owner: v.owner,
        ownerDef: v.ownerDef,
        team: v.team,
        x: v.x,
        y: v.y,
        dirX: v.dirX,
        dirY: v.dirY,
        tx: v.x,
        ty: v.y,
      });
    }
  }
}
