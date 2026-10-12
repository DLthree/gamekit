import type { DeliveryNode } from "@/content/schema/skill";
import type { ActorStats, Role, SourcedMod } from "@/content/schema/vocab";
import type { SimContent } from "@/content/types";
import { ticks } from "@/core/clock";
import { type Id, idIndex } from "@/core/ids";
import { createRng, type Rng } from "@/core/rng";
import { SpatialHash } from "@/core/spatial-hash";
import { type Actor, type ActorStore, createActorStore, spawnActor } from "@/sim/actors/store";
import type { CastCommand } from "@/sim/command";
import { EventBuffer, type Outcome, type Team } from "@/sim/events";
import { checkTunnelling, enemyTemplates, playerSkills } from "@/sim/loadout";
import { createReport, type WaveReport } from "@/sim/report";
import { checkScenario, type Scenario } from "@/sim/scenario";
import type { ResolvedSkill } from "@/sim/skills/instance";
import { createSpawnQueue, type SpawnQueue } from "@/sim/spawn-queue";
import { resolveActorStats } from "@/sim/stats/resolve";
import { createVolumeStore, type VolumeStore } from "@/sim/volumes/store";

/** An enemy kind with the threat tier's mods already applied. */
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
  /** The target point (R3): the target, `range` along the aim, or a parent volume's end. */
  tx: number;
  ty: number;
}

/** (volume slot, actor slot) pairs found in the hit phase, applied in the resolve phase. */
export interface HitBuffer {
  volume: Int32Array;
  actor: Int32Array;
  count: number;
}

/** A warned field spawn waiting for its wave tick. */
export interface PendingSpawn {
  def: string;
  x: number;
  y: number;
  /** The wave tick (`WaveState.elapsed`) it joins the spawn queue on. */
  due: number;
}

export interface WaveState {
  /** Wave ticks played. */
  elapsed: number;
  /** Per spawn entry: fractional spawns carried to the next tick. */
  carry: number[];
  /** Warned field spawns waiting for their wave tick. */
  pending: PendingSpawn[];
}

export type WavePhase = "countdown" | "playing" | "ended";

export interface World {
  content: SimContent;
  scenario: Scenario;
  tick: number;
  freezeTicks: number;
  countdownTicks: number;
  durationTicks: number;
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

export function createWorld(scenario: Scenario, content: SimContent): World {
  checkScenario(scenario, content);
  const { limits, feel } = content.rules;
  const character = content.characters[scenario.character];
  const tier = content.builds[scenario.character].tiers[scenario.buildTier - 1];
  const threatId = `tier-${scenario.threatTier}`;
  const threat = content.threats[threatId];
  const buildSource = `builds/${scenario.character}.json tier ${scenario.buildTier}`;
  const buildMods: SourcedMod[] = tier.stats.map((mod) => ({ mod, source: buildSource }));
  const enemyMods: SourcedMod[] = threat.enemyMods.map((mod) => ({
    mod,
    source: `threats/${threatId}.json`,
  }));

  const templates = enemyTemplates(content, enemyMods);
  let maxRadius = 0;
  for (const t of Object.values(templates)) maxRadius = Math.max(maxRadius, t.stats.radius);

  const stats = resolveActorStats(character.stats, buildMods);
  const skills = playerSkills(
    content,
    scenario.character,
    scenario.buildTier,
    buildMods,
    buildSource,
  );
  checkTunnelling(skills, templates, buildSource);
  const actors = createActorStore(limits.actors);
  const player = spawnActor(actors, {
    def: scenario.character,
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
    scenario,
    tick: 0,
    freezeTicks: 0,
    countdownTicks,
    durationTicks: ticks(threat.durationS),
    phase: countdownTicks > 0 ? "countdown" : "playing",
    outcome: null,
    rng: createRng(scenario.seed),
    actors,
    volumes: createVolumeStore(limits.volumes),
    hash: new SpatialHash(limits.hashCellSize, limits.actors),
    scratch: new Int32Array(limits.actors),
    playerId: player.id,
    maxRadius: Math.max(maxRadius, stats.radius),
    events: new EventBuffer(limits.events),
    spawns: createSpawnQueue(),
    hits: {
      volume: new Int32Array(limits.hits),
      actor: new Int32Array(limits.hits),
      count: 0,
    },
    deliveries: [],
    cast: null,
    templates,
    wave: { elapsed: 0, carry: threat.spawns.map(() => 0), pending: [] },
    report: createReport(stats.life),
  };
}

/** The player actor. It is never released, so this never misses. */
export function playerOf(world: World): Actor {
  return world.actors.items[idIndex(world.playerId)];
}
