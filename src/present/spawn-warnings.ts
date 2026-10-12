import type { SpawnWarningLook } from "@/content/schema/look";

/** One marker as drawn this frame. */
export interface WarningDraw {
  x: number;
  y: number;
  /** The ring's radius, pulse included. */
  radius: number;
  /** 0 → 1 over the warning: how far the fill has grown towards the ring. */
  fill: number;
}

interface Warning {
  x: number;
  y: number;
  /** Half the enemy's body height, world units. */
  size: number;
  start: number;
  end: number;
}

/** Pending field spawns as the view sees them: a marker at each point until its enemy appears. */
export class SpawnWarnings {
  private items: Warning[] = [];

  get size(): number {
    return this.items.length;
  }

  warn(x: number, y: number, size: number, start: number, end: number): void {
    this.items.push({ x, y, size, start, end });
  }

  /** Drops the markers whose enemy has appeared by sim time t. */
  prune(t: number): void {
    this.items = this.items.filter((w) => w.end > t);
  }

  /** Fills `out` (grown as needed) with each marker at sim time t; returns how many. */
  markers(t: number, look: SpawnWarningLook, out: WarningDraw[]): number {
    for (const [i, w] of this.items.entries()) {
      if (out.length <= i) out.push({ x: 0, y: 0, radius: 0, fill: 0 });
      const age = t - w.start;
      const d = out[i];
      d.x = w.x;
      d.y = w.y;
      d.radius =
        w.size * look.scale * (1 + look.pulse * Math.sin(Math.PI * 2 * look.pulseHz * age));
      d.fill = w.end > w.start ? Math.min(1, age / (w.end - w.start)) : 1;
    }
    return this.items.length;
  }
}
