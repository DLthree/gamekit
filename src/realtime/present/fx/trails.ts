import type { LookContent } from "@/content/types";
import type { ProjectileVfx } from "@/realtime/content/schema/look-fx";
import type { Id } from "@/realtime/core/ids";
import { type Emitter, resolveTint } from "@/realtime/present/fx/emit";
import {
  type HeadDraw,
  headDraw,
  newHeadDraw,
  trailStep,
} from "@/realtime/present/fx/recipes/projectile";
import { getVolume } from "@/realtime/sim/volumes/store";
import type { World } from "@/realtime/sim/world";

interface Tracked {
  vfx: ProjectileVfx;
  build: string | null;
  headTint: number;
  start: number;
  nextTrail: number;
  x: number;
  y: number;
  dirX: number;
  dirY: number;
}

/** Live projectiles as the view sees them: position from the sim, trail timing kept here. */
export class ProjectileTracker {
  private readonly tracked = new Map<Id, Tracked>();
  private readonly look: LookContent;

  constructor(look: LookContent) {
    this.look = look;
  }

  get size(): number {
    return this.tracked.size;
  }

  start(id: Id, vfx: ProjectileVfx, build: string | null, t: number): void {
    const headTint = resolveTint(
      this.look,
      vfx.head.tint,
      build,
      `projectile ${vfx.head.texture} head`,
    );
    this.tracked.set(id, {
      vfx,
      build,
      headTint,
      start: t,
      nextTrail: t,
      x: 0,
      y: 0,
      dirX: 1,
      dirY: 0,
    });
  }

  end(id: Id): void {
    this.tracked.delete(id);
  }

  /** Follows each projectile and drops a trail puff every `trail.everyS` of sim time. */
  update(world: World, em: Emitter, t: number): void {
    for (const [id, tr] of this.tracked) {
      const v = getVolume(world.volumes, id);
      // Every volume emits `volumeEnded` (which calls end()) before the sim releases it, and
      // present() sees every tick's events, so a tracked id losing its volume without an
      // `end()` call first is a bug, not a normal race: fail fast rather than hide it.
      if (v === null) throw new Error(`trails: tracked projectile ${id} has no volume`);
      tr.x = v.x;
      tr.y = v.y;
      tr.dirX = v.dirX;
      tr.dirY = v.dirY;
      while (tr.nextTrail <= t) {
        trailStep(em, tr.vfx, v.x, v.y, v.dirX, v.dirY, v.speed, tr.nextTrail, tr.build);
        tr.nextTrail += tr.vfx.trail.everyS;
      }
    }
  }

  /** Writes the heads to draw into `out` (grown as needed); returns how many. */
  heads(t: number, out: HeadDraw[]): number {
    let n = 0;
    for (const tr of this.tracked.values()) {
      if (out.length <= n) out.push(newHeadDraw());
      const head = out[n];
      if (head === undefined) throw new Error("trails: heads() out array missing a slot");
      headDraw(tr.vfx, tr.x, tr.y, tr.dirX, tr.dirY, t - tr.start, head);
      head.tint = tr.headTint;
      n += 1;
    }
    return n;
  }
}
