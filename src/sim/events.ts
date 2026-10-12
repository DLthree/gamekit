import type { Role } from "@/content/schema/vocab";
import type { Id } from "@/core/ids";
import type { OUTCOMES } from "@/game/vocab";

export type Team = "player" | "enemy";
export type VolumeKind = "projectile" | "burst" | "zone";
export type VolumeShape = "circle" | "arc" | "lane";
/** How a wave ended: one of the game's OUTCOMES (src/game/vocab.ts). */
export type Outcome = (typeof OUTCOMES)[number];

/** Everything the sim tells the outside world, per tick. Ids, positions and content keys only. */
export type SimEvent =
  | {
      t: "spawned";
      tick: number;
      id: Id;
      def: string;
      role: Role | "player";
      team: Team;
      x: number;
      y: number;
    }
  /** A field spawn's point: enemy `def` appears at (x, y) on `spawnTick` (if maxEnemies allows). */
  | { t: "spawnWarned"; tick: number; def: string; x: number; y: number; spawnTick: number }
  | {
      t: "died";
      tick: number;
      id: Id;
      def: string;
      role: Role | "player";
      x: number;
      y: number;
      killer: string | null;
      skill: string | null;
    }
  | {
      t: "hit";
      tick: number;
      target: Id;
      targetDef: string;
      team: Team;
      source: Id;
      skill: string;
      amount: number;
      x: number;
      y: number;
      kx: number;
      ky: number;
    }
  | {
      t: "cast";
      tick: number;
      caster: Id;
      casterDef: string;
      team: Team;
      skill: string;
      ax: number;
      ay: number;
    }
  | {
      t: "volumeStarted";
      tick: number;
      id: Id;
      kind: VolumeKind;
      vfx: string;
      team: Team;
      owner: Id;
      ownerDef: string;
      x: number;
      y: number;
      r: number;
      halfAngle: number;
      dirX: number;
      dirY: number;
      /** Ticks the volume lives (zones); 0 = until its contact, its range or its one sweep. */
      lifeTicks: number;
      shape: VolumeShape;
      /** Lanes: the capsule's length along (dirX, dirY); r is its half-width. 0 otherwise. */
      length: number;
      /** Ticks it warns (harmless, drawn as a telegraph) before it sweeps; 0 = unwarned. */
      warnTicks: number;
      /** Where the delivery came from (the caster, for placed marks). */
      ox: number;
      oy: number;
    }
  | {
      t: "volumeEnded";
      tick: number;
      id: Id;
      kind: VolumeKind;
      vfx: string;
      team: Team;
      ownerDef: string;
      x: number;
      y: number;
      r: number;
      /** Ended by its owner's death while warning: it never swept. */
      cancelled: boolean;
    }
  /** An enemy's warned burst swept (just before its volumeEnded): did the player stay in it? */
  | {
      t: "telegraphResolved";
      tick: number;
      id: Id;
      vfx: string;
      ownerDef: string;
      x: number;
      y: number;
      r: number;
      hitPlayer: boolean;
    }
  | { t: "playerHurt"; tick: number; amount: number; hp: number; by: string | null }
  | { t: "waveEnded"; tick: number; outcome: Outcome };

/** A tick's events, capped: a world nobody renders must not grow. Overflow is counted, not thrown. */
export class EventBuffer {
  readonly capacity: number;
  readonly items: SimEvent[] = [];
  overflow = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  push(e: SimEvent): void {
    if (this.items.length >= this.capacity) {
      this.overflow += 1;
      return;
    }
    this.items.push(e);
  }

  clear(): void {
    this.items.length = 0;
  }
}
