import type { LookFx } from "@/realtime/content/schema/look-fx";

/** One pooled effect instance: plain data; the renderer maps slots to display objects. */
export interface FxInstance {
  kind: string;
  slot: number;
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Sim time it starts (may be in the future: delayed effects are invisible until then). */
  at: number;
  life: number;
  /** Longest side in world units at scale 1. */
  size: number;
  rot: number;
  spin: number;
  variant: number;
  tint: number;
  alpha: number;
  /** 0..1 per-instance randomness (flicker phase). */
  seed: number;
}

export type FxSpawn = Omit<FxInstance, "slot" | "alive">;

export interface FxCounts {
  total: number;
  dropped: number;
  droppedByKind: Record<string, number>;
  kinds: Record<string, number>;
}

/**
 * Fixed-capacity effect instances. Past the total capacity or a kind's cap a spawn is dropped
 * and counted, except for evict kinds, which free the instance ending soonest.
 */
export class FxPool {
  readonly items: FxInstance[] = [];
  dropped = 0;
  /** While stopped, spawns are ignored (not dropped), so tests can watch the pool drain. */
  stopped = false;
  private readonly free: number[] = [];
  private readonly live = new Map<string, number>();
  private readonly droppedKinds = new Map<string, number>();
  private readonly fx: LookFx;

  constructor(fx: LookFx) {
    this.fx = fx;
    for (const kind of Object.keys(fx.kinds)) this.live.set(kind, 0);
  }

  private liveCount(kind: string): number {
    const n = this.live.get(kind);
    if (n === undefined) throw new Error(`no fx kind ${kind} in look/fx.json`);
    return n;
  }

  private drop(kind: string): null {
    this.dropped += 1;
    this.droppedKinds.set(kind, (this.droppedKinds.get(kind) ?? 0) + 1);
    return null;
  }

  spawn(s: FxSpawn): FxInstance | null {
    if (this.stopped) return null;
    const kind = this.fx.kinds[s.kind];
    if (kind === undefined) throw new Error(`no fx kind ${s.kind} in look/fx.json`);
    if (this.liveCount(s.kind) >= kind.cap) {
      const old = kind.evict ? this.endingSoonest(s.kind) : null;
      if (old === null) return this.drop(s.kind);
      this.release(old);
    }
    let slot = this.free.pop();
    if (slot === undefined) {
      if (this.items.length >= this.fx.capacity) return this.drop(s.kind);
      slot = this.items.length;
      this.items.push({ ...s, slot, alive: false });
    }
    const inst = this.items[slot];
    if (inst === undefined) throw new Error(`fx pool slot ${slot} missing an instance`);
    Object.assign(inst, s);
    inst.slot = slot;
    inst.alive = true;
    this.live.set(s.kind, this.liveCount(s.kind) + 1);
    return inst;
  }

  private endingSoonest(kind: string): FxInstance | null {
    let best: FxInstance | null = null;
    for (const inst of this.items) {
      if (
        inst.alive &&
        inst.kind === kind &&
        (best === null || inst.at + inst.life < best.at + best.life)
      ) {
        best = inst;
      }
    }
    return best;
  }

  /** Frees every instance whose life has ended by sim time t. */
  expire(t: number): void {
    for (const inst of this.items) if (inst.alive && t - inst.at >= inst.life) this.release(inst);
  }

  release(inst: FxInstance): void {
    if (!inst.alive) return;
    inst.alive = false;
    this.free.push(inst.slot);
    this.live.set(inst.kind, this.liveCount(inst.kind) - 1);
  }

  counts(): FxCounts {
    const kinds: Record<string, number> = {};
    let total = 0;
    for (const [kind, n] of this.live) {
      kinds[kind] = n;
      total += n;
    }
    return {
      total,
      dropped: this.dropped,
      droppedByKind: Object.fromEntries(this.droppedKinds),
      kinds,
    };
  }
}
