import type { Creature } from "@/content/schema/look";
import type { SpriteDef } from "@/content/schema/sprites";
import type { Content } from "@/content/types";
import type { Id } from "@/core/ids";
import { nextFloat, nextRange, type Rng } from "@/core/rng";

/** The creature profile that draws a character or an enemy def. */
export function creatureOf(content: Content, def: string): Creature {
  const character = content.look.characters.characters[def];
  if (character !== undefined) return content.look.creatures.creatures[character.creature];
  const enemy = content.sim.enemies[def];
  if (enemy === undefined) throw new Error(`no character or enemy ${def} to draw`);
  return content.look.creatures.creatures[enemy.look];
}

export function spriteOf(content: Content, id: string): SpriteDef {
  const s = content.look.sprites.sprites.find((it) => it.id === id);
  if (s === undefined) throw new Error(`no sprite ${id} in look/generated/sprites.json`);
  return s;
}

export function bodyHeight(content: Content, def: string): number {
  return spriteOf(content, creatureOf(content, def).sprite).world[1];
}

interface AnimState {
  rate: number;
  phase: number;
  hitAt: number;
  castAt: number;
  castX: number;
  castY: number;
  facing: 1 | -1;
  thrustAt: number;
}

/** A dead actor's sprite, kept by the view for its death pop after the sim forgot it. */
export interface Ghost {
  id: Id;
  def: string;
  x: number;
  y: number;
  facing: 1 | -1;
  at: number;
}

/** Per-actor presentation state, keyed by generational id. */
export class ActorAnims {
  readonly ghosts: Ghost[] = [];
  private readonly states = new Map<Id, AnimState>();
  private readonly rng: Rng;
  private readonly speedJitter: number;

  constructor(rng: Rng, speedJitter: number) {
    this.rng = rng;
    this.speedJitter = speedJitter;
  }

  state(id: Id): AnimState {
    let s = this.states.get(id);
    if (s === undefined) {
      s = {
        rate: 1 + nextRange(this.rng, -this.speedJitter, this.speedJitter),
        phase: nextFloat(this.rng) * 10,
        hitAt: Number.NEGATIVE_INFINITY,
        castAt: Number.NEGATIVE_INFINITY,
        castX: 1,
        castY: 0,
        facing: 1,
        thrustAt: Number.NEGATIVE_INFINITY,
      };
      this.states.set(id, s);
    }
    return s;
  }

  /** A hit on `id`; false within limitS of the last one shown (no new flash, ink or sound). */
  hit(id: Id, t: number, limitS: number): boolean {
    const s = this.state(id);
    if (t - s.hitAt < limitS) return false;
    s.hitAt = t;
    return true;
  }

  /** A cast by `id` toward the unit aim (ax, ay): lunge (enemies) or spring and recoil (player). */
  cast(id: Id, t: number, ax: number, ay: number): void {
    const s = this.state(id);
    s.castAt = t;
    s.castX = ax;
    s.castY = ay;
  }

  /** A manual cast by `id`: its prop thrusts. */
  thrust(id: Id, t: number): void {
    this.state(id).thrustAt = t;
  }

  died(id: Id, def: string, x: number, y: number, t: number): void {
    this.ghosts.push({ id, def, x, y, facing: this.state(id).facing, at: t });
    this.states.delete(id);
  }

  prune(t: number, durationS: number): void {
    let n = 0;
    for (const g of this.ghosts) if (t - g.at < durationS) this.ghosts[n++] = g;
    this.ghosts.length = n;
  }
}
