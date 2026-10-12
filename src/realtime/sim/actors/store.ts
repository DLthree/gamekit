import type { Role } from "@/content/schema/vocab";
import { type Id, idGeneration, idIndex, nextGeneration, packId } from "@/realtime/core/ids";
import type { Team } from "@/realtime/sim/events";
import type { SkillInstance } from "@/realtime/sim/skills/instance";

/** The player and every enemy. Role is data; there is no enemy subtype. */
export interface Actor {
  id: Id;
  slot: number;
  generation: number;
  alive: boolean;
  def: string;
  team: Team;
  role: Role | "player";
  x: number;
  y: number;
  /** Knockback velocity (units/s), damped every tick. */
  vx: number;
  vy: number;
  /** Move intent this tick, length ≤ 1. */
  moveX: number;
  moveY: number;
  facing: 1 | -1;
  radius: number;
  hp: number;
  maxHp: number;
  moveSpeed: number;
  knockbackResist: number;
  skills: SkillInstance[];
  /** Walk intent is ignored while tick < this (an owner-bound telegraph holds its caster). */
  holdUntilTick: number;
  /** Ticks left in a dash (the dash primitive); while > 0, `moveActors` walks it at dashV instead. */
  dashTicks: number;
  dashVX: number;
  dashVY: number;
}

export type ActorInit = Pick<
  Actor,
  "def" | "team" | "role" | "x" | "y" | "radius" | "hp" | "moveSpeed" | "knockbackResist" | "skills"
>;

export interface ActorStore {
  readonly items: Actor[];
  readonly free: number[];
  alive: number;
}

function blank(slot: number): Actor {
  return {
    id: packId(slot, 0),
    slot,
    generation: 0,
    alive: false,
    def: "",
    team: "enemy",
    role: "player",
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    moveX: 0,
    moveY: 0,
    facing: 1,
    radius: 1,
    hp: 0,
    maxHp: 0,
    moveSpeed: 0,
    knockbackResist: 0,
    skills: [],
    holdUntilTick: 0,
    dashTicks: 0,
    dashVX: 0,
    dashVY: 0,
  };
}

export function createActorStore(capacity: number): ActorStore {
  const items: Actor[] = [];
  const free: number[] = [];
  for (let i = 0; i < capacity; i++) {
    items.push(blank(i));
    free.push(capacity - 1 - i);
  }
  return { items, free, alive: 0 };
}

/** Fills every field of a free slot (one object shape, no allocation); null when full. */
export function spawnActor(store: ActorStore, init: ActorInit): Actor | null {
  const slot = store.free.pop();
  if (slot === undefined) return null;
  const a = store.items[slot];
  a.generation = nextGeneration(a.generation);
  a.id = packId(slot, a.generation);
  a.alive = true;
  a.def = init.def;
  a.team = init.team;
  a.role = init.role;
  a.x = init.x;
  a.y = init.y;
  a.vx = 0;
  a.vy = 0;
  a.moveX = 0;
  a.moveY = 0;
  a.facing = 1;
  a.radius = init.radius;
  a.hp = init.hp;
  a.maxHp = init.hp;
  a.moveSpeed = init.moveSpeed;
  a.knockbackResist = init.knockbackResist;
  a.skills = init.skills;
  a.holdUntilTick = 0;
  a.dashTicks = 0;
  a.dashVX = 0;
  a.dashVY = 0;
  store.alive += 1;
  return a;
}

export function releaseActor(store: ActorStore, a: Actor): void {
  if (!a.alive) throw new Error(`actor ${a.id} released twice`);
  a.alive = false;
  a.skills = [];
  store.free.push(a.slot);
  store.alive -= 1;
}

/** The live actor with this id, or null if it died and its slot moved on. */
export function getActor(store: ActorStore, id: Id): Actor | null {
  const a = store.items[idIndex(id)];
  return a?.alive && a.generation === idGeneration(id) ? a : null;
}
