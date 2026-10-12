import type { Scenario } from "@/game/scenario";
import type { Actor } from "@/sim/actors/store";
import { type Command, IDLE } from "@/sim/command";
import type { SimEvent } from "@/sim/events";
import { drainSpawns, queueEnemy } from "@/sim/spawn-queue";
import { step } from "@/sim/step";
import { createWorld, type World } from "@/sim/world";
import { type FilePatch, testContent } from "@/test/content";

export const TEST_SCENARIO: Scenario = {
  character: "hero",
  buildTier: 1,
  threatTier: 1,
  seed: 1,
  overrides: [],
};

/** A world on the small test content, optionally patched. */
export function testWorld(patch: FilePatch = {}, scenario: Partial<Scenario> = {}): World {
  return createWorld({ ...TEST_SCENARIO, ...scenario }, testContent(patch).sim);
}

/** Runs n steps with one command; returns every event they emitted, in order. */
export function run(world: World, n: number, command: Command = IDLE): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    step(world, command);
    out.push(...world.events.items);
  }
  return out;
}

export function enemies(world: World): Actor[] {
  return world.actors.items.filter((a) => a.alive && a.team === "enemy");
}

/** A command that casts the cast slot toward (x, y) this tick. */
export function castAt(x: number, y: number): Command {
  return { moveX: 0, moveY: 0, cast: { slot: "cast", aim: { x, y } } };
}

/** Puts an enemy into the world now (through the real spawn queue) and returns it. */
export function place(world: World, def: string, x: number, y: number): Actor {
  queueEnemy(world, def, x, y);
  drainSpawns(world);
  const e = world.events.items.at(-1);
  if (e === undefined || e.t !== "spawned") throw new Error(`place: ${def} did not spawn`);
  const a = world.actors.items.find((it) => it.id === e.id);
  if (a === undefined) throw new Error("place: spawned actor not in the store");
  return a;
}

/** Steps until an event of kind `t` goes out (at most `max` steps); returns the first one. */
export function runUntilEvent<T extends SimEvent["t"]>(
  world: World,
  t: T,
  max = 600,
  command: Command = IDLE,
): Extract<SimEvent, { t: T }> {
  for (let i = 0; i < max; i++) {
    step(world, command);
    const e = world.events.items.find((it): it is Extract<SimEvent, { t: T }> => it.t === t);
    if (e !== undefined) return e;
  }
  throw new Error(`runUntilEvent: no ${t} within ${max} steps`);
}
