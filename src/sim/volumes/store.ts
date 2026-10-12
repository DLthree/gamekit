import type { DeliveryNode } from "@/content/schema/skill";
import type { DamageType } from "@/content/schema/vocab";
import { type Id, idGeneration, idIndex, nextGeneration, packId } from "@/core/ids";
import { DAMAGE_TYPES } from "@/game/vocab";
import type { Team, VolumeKind, VolumeShape } from "@/sim/events";
import type { ResolvedSkill } from "@/sim/skills/instance";

/** Every hit shape in the world: projectiles (hit on contact), bursts (sweep once), zones (pulse). */
export interface Volume {
  id: Id;
  slot: number;
  generation: number;
  alive: boolean;
  kind: VolumeKind;
  vfx: string;
  owner: Id;
  ownerDef: string;
  team: Team;
  skill: ResolvedSkill;
  /** The delivery node that made it; its onEnd children run where it ends. */
  node: DeliveryNode;
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  speed: number;
  /** Projectiles end after travelling this far. */
  range: number;
  travelled: number;
  radius: number;
  /** How a sweep tests bodies; projectiles and zones are circles. A lane's half-width is `radius`. */
  shape: VolumeShape;
  /** Lanes: the capsule's length from (x, y) along the direction; 0 otherwise. */
  length: number;
  /** Bursts: half the arc's angle in radians (π = full circle). */
  halfAngle: number;
  damage: Record<DamageType, number>;
  knockback: number;
  hitStop: boolean;
  /** Ticks after bornTick the volume warns: harmless, it never enters collectHits. */
  warnTicks: number;
  /** Owner-bound: a warning volume whose owner died is cancelled (moveVolumes). */
  cancelOnOwnerDeath: boolean;
  /** Ended by its owner's death: no resolve, no onEnd children. */
  cancelled: boolean;
  /** Warned bursts: whether their sweep found the player (telegraphResolved.hitPlayer). */
  hitPlayer: boolean;
  /** Where the delivery that made it came from (the caster, for marks placed at a target). */
  ox: number;
  oy: number;
  /** Zones: ticks it lives, the tick it spawned, ticks between pulses, the next pulse's tick. */
  lifeTicks: number;
  bornTick: number;
  pulseTicks: number;
  nextPulseTick: number;
  /** Projectiles: bodies it may still hit (1 + pierce); the ids it hit, so none is hit twice. */
  hitsLeft: number;
  hitIds: Float64Array;
  hitCount: number;
  /** Set in the tick it ends; the volume is released in cleanup after its event went out. */
  ended: boolean;
}

export type VolumeInit = Pick<
  Volume,
  | "kind"
  | "vfx"
  | "owner"
  | "ownerDef"
  | "team"
  | "skill"
  | "node"
  | "x"
  | "y"
  | "dirX"
  | "dirY"
  | "speed"
  | "range"
  | "radius"
  | "shape"
  | "length"
  | "halfAngle"
  | "knockback"
  | "hitStop"
  | "lifeTicks"
  | "pulseTicks"
  | "hitsLeft"
  | "warnTicks"
  | "cancelOnOwnerDeath"
  | "ox"
  | "oy"
> & { damageScale: number };

export interface VolumeStore {
  readonly items: Volume[];
  readonly free: number[];
  alive: number;
}

/** pierce is clamped to 15 (src/sim/stats/ids.ts), so a projectile hits at most 16 bodies. */
export const MAX_HITS = 16;

function zeroDamage(): Record<DamageType, number> {
  const d = {} as Record<DamageType, number>;
  for (const type of DAMAGE_TYPES) d[type] = 0;
  return d;
}

function fresh(slot: number, init: VolumeInit): Volume {
  const { damageScale: _, ...fields } = init;
  return {
    ...fields,
    id: packId(slot, 0),
    slot,
    generation: 0,
    alive: false,
    travelled: 0,
    bornTick: 0,
    nextPulseTick: 0,
    damage: zeroDamage(),
    hitIds: new Float64Array(MAX_HITS),
    hitCount: 0,
    ended: false,
    cancelled: false,
    hitPlayer: false,
  };
}

/** Volume objects are created on a slot's first use and reused after (one shape, no churn). */
export function createVolumeStore(capacity: number): VolumeStore {
  const free: number[] = [];
  for (let i = 0; i < capacity; i++) free.push(capacity - 1 - i);
  return { items: [], free, alive: 0 };
}

export function spawnVolume(store: VolumeStore, init: VolumeInit, tick: number): Volume | null {
  const slot = store.free.pop();
  if (slot === undefined) return null;
  let v = store.items[slot];
  if (v === undefined) {
    v = fresh(slot, init);
    store.items[slot] = v;
  }
  v.generation = nextGeneration(v.generation);
  v.id = packId(slot, v.generation);
  v.alive = true;
  v.kind = init.kind;
  v.vfx = init.vfx;
  v.owner = init.owner;
  v.ownerDef = init.ownerDef;
  v.team = init.team;
  v.skill = init.skill;
  v.node = init.node;
  v.x = init.x;
  v.y = init.y;
  v.dirX = init.dirX;
  v.dirY = init.dirY;
  v.speed = init.speed;
  v.range = init.range;
  v.travelled = 0;
  v.radius = init.radius;
  v.shape = init.shape;
  v.length = init.length;
  v.halfAngle = init.halfAngle;
  for (const type of DAMAGE_TYPES) v.damage[type] = init.skill.damage[type] * init.damageScale;
  v.knockback = init.knockback;
  v.hitStop = init.hitStop;
  v.lifeTicks = init.lifeTicks;
  v.pulseTicks = init.pulseTicks;
  v.hitsLeft = init.hitsLeft;
  v.warnTicks = init.warnTicks;
  v.cancelOnOwnerDeath = init.cancelOnOwnerDeath;
  v.cancelled = false;
  v.hitPlayer = false;
  v.ox = init.ox;
  v.oy = init.oy;
  v.hitCount = 0;
  v.bornTick = tick;
  // A zone's first pulse is on its first tick in the world (it joins in phase 10).
  v.nextPulseTick = tick + 1;
  v.ended = false;
  store.alive += 1;
  return v;
}

/** A warning volume is harmless and drawn as a telegraph until its warning ends. */
export function isWarning(v: Volume, tick: number): boolean {
  return tick < v.bornTick + v.warnTicks;
}

export function releaseVolume(store: VolumeStore, v: Volume): void {
  if (!v.alive) throw new Error(`volume ${v.id} released twice`);
  v.alive = false;
  store.free.push(v.slot);
  store.alive -= 1;
}

export function getVolume(store: VolumeStore, id: Id): Volume | null {
  const v = store.items[idIndex(id)];
  return v?.alive && v.generation === idGeneration(id) ? v : null;
}
