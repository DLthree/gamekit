import type { DeliveryNode } from "@/content/schema/skill";
import type { ActorStats, Role } from "@/content/schema/vocab";
import type { SimContent } from "@/content/types";
import { ticks } from "@/core/clock";
import { type Id, idIndex } from "@/core/ids";
import { createRng, type Rng } from "@/core/rng";
import { SpatialHash } from "@/core/spatial-hash";
import type { WaveReport } from "@/game/report";
import type { Scenario } from "@/game/scenario";
import type { WaveState } from "@/game/wave/director";
import { type Actor, type ActorStore, createActorStore, spawnActor } from "@/sim/actors/store";
import type { CastCommand } from "@/sim/command";
import { EventBuffer, type Outcome, type Team } from "@/sim/events";
import type { ResolvedSkill, SkillInstance } from "@/sim/skills/instance";
import { createSpawnQueue, type SpawnQueue } from "@/sim/spawn-queue";
import { createVolumeStore, type VolumeStore } from "@/sim/volumes/store";

/** An enemy kind with its stats and skills resolved (the game applies its mods first). */
export interface EnemyTemplate {
  role: Role;
  stats: ActorStats;
  skills: readonly ResolvedSkill[];
}

/** A delivery node to run in the next activate phase (a cast, or an ended volume's child). */
export interface Delivery {
  skill: ResolvedSkill;
  node: DeliveryNode;
  owner: Id;
  ownerDef: string;
  team: Team;
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  /** The target point: the target, `range` along the aim, or a parent volume's end. */
  tx: number;
  ty: number;
}

/** (volume slot, actor slot) pairs found in the hit phase, applied in the resolve phase. */
export interface HitBuffer {
  volume: Int32Array;
  actor: Int32Array;
  count: number;
}

export type WavePhase = "countdown" | "playing" | "ended";

export interface World {
  content: SimContent;
  scenario: Scenario;
  tick: number;
  freezeTicks: number;
  countdownTicks: number;
  durationTicks: number;
  maxEnemies: number;
  phase: WavePhase;
  outcome: Outcome | null;
  rng: Rng;
  actors: ActorStore;
  volumes: VolumeStore;
  hash: SpatialHash;
  /** Query results scratch, sized to the actor capacity. */
  scratch: Int32Array;
  playerId: Id;
  /** The largest actor radius; queries widen by it so a big body's edge is found. */
  maxRadius: number;
  events: EventBuffer;
  spawns: SpawnQueue;
  hits: HitBuffer;
  deliveries: Delivery[];
  /** This tick's cast request (phase 1), consumed by the player's skills (phase 2). */
  cast: CastCommand | null;
  templates: Record<string, EnemyTemplate>;
  wave: WaveState;
  report: WaveReport;
}

/** What the game hands the kit to start a world: the player, the enemy kinds, and its rules' state. */
export interface WorldInit {
  scenario: Scenario;
  seed: number;
  player: { def: string; stats: ActorStats; skills: SkillInstance[] };
  templates: Record<string, EnemyTemplate>;
  /** Spawns past this many living enemies are dropped (counted in the report). */
  maxEnemies: number;
  durationTicks: number;
  wave: WaveState;
  report: WaveReport;
}

export function createWorld(content: SimContent, init: WorldInit): World {
  const { limits, feel } = content.rules;
  const { stats, skills } = init.player;
  let maxRadius = stats.radius;
  for (const t of Object.values(init.templates)) maxRadius = Math.max(maxRadius, t.stats.radius);
  const actors = createActorStore(limits.actors);
  const player = spawnActor(actors, {
    def: init.player.def,
    team: "player",
    role: "player",
    x: 0,
    y: 0,
    radius: stats.radius,
    hp: stats.life,
    moveSpeed: stats.moveSpeed,
    knockbackResist: stats.knockbackResist,
    skills,
  });
  if (player === null) throw new Error("rules/limits.json › actors: no room for the player");

  const countdownTicks = ticks(feel.countdownS);
  return {
    content,
    scenario: init.scenario,
    tick: 0,
    freezeTicks: 0,
    countdownTicks,
    durationTicks: init.durationTicks,
    maxEnemies: init.maxEnemies,
    phase: countdownTicks > 0 ? "countdown" : "playing",
    outcome: null,
    rng: createRng(init.seed),
    actors,
    volumes: createVolumeStore(limits.volumes),
    hash: new SpatialHash(limits.hashCellSize, limits.actors),
    scratch: new Int32Array(limits.actors),
    playerId: player.id,
    maxRadius,
    events: new EventBuffer(limits.events),
    spawns: createSpawnQueue(),
    hits: {
      volume: new Int32Array(limits.hits),
      actor: new Int32Array(limits.hits),
      count: 0,
    },
    deliveries: [],
    cast: null,
    templates: init.templates,
    wave: init.wave,
    report: init.report,
  };
}

/** The player actor. It is never released, so this never misses. */
export function playerOf(world: World): Actor {
  return world.actors.items[idIndex(world.playerId)];
}
