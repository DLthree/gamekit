import type { DamageType, SlotId } from "@/content/schema/vocab";
import type { Scenario } from "@/game/scenario";
import type { SkillStatId } from "@/realtime/content/skill-stats";
import type { Actor } from "@/realtime/sim/actors/store";
import type { Outcome, Team, VolumeKind } from "@/realtime/sim/events";
import { playerOf, type WavePhase, type World } from "@/realtime/sim/world";

export interface ActorSummary {
  id: number;
  def: string;
  team: Team;
  role: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  facing: number;
}

export interface VolumeSummary {
  id: number;
  kind: VolumeKind;
  vfx: string;
  team: Team;
  x: number;
  y: number;
  r: number;
  /** Ticks until a warned volume sweeps; 0 once it is live (or if it never warned). */
  warnTicksLeft: number;
}

export interface SkillSummary {
  slot: SlotId | null;
  skill: string;
  readyInTicks: number;
  intervalTicks: number;
  damage: Record<DamageType, number>;
  stats: Partial<Record<SkillStatId, number>>;
}

/** A JSON view of the world for __game.state(), tests and bug reports. */
export interface WorldSummary {
  scenario: Scenario;
  tick: number;
  phase: WavePhase;
  outcome: Outcome | null;
  waveTicks: number;
  durationTicks: number;
  freezeTicks: number;
  player: ActorSummary;
  skills: SkillSummary[];
  enemies: number;
  actors: ActorSummary[];
  volumes: VolumeSummary[];
  counters: { eventOverflow: number; droppedSpawns: number; droppedVolumes: number };
}

function actorSummary(a: Actor): ActorSummary {
  return {
    id: a.id,
    def: a.def,
    team: a.team,
    role: a.role,
    x: a.x,
    y: a.y,
    hp: a.hp,
    maxHp: a.maxHp,
    facing: a.facing,
  };
}

export function summarize(world: World): WorldSummary {
  const player = playerOf(world);
  const actors = world.actors.items.filter((a) => a.alive).map(actorSummary);
  return {
    scenario: { ...world.scenario, overrides: [...world.scenario.overrides] },
    tick: world.tick,
    phase: world.phase,
    outcome: world.outcome,
    waveTicks: world.wave.elapsed,
    durationTicks: world.durationTicks,
    freezeTicks: world.freezeTicks,
    player: actorSummary(player),
    skills: player.skills.map((s) => ({
      slot: s.slot,
      skill: s.skill.id,
      readyInTicks: Math.max(0, s.readyTick - world.tick),
      intervalTicks: s.skill.intervalTicks,
      damage: { ...s.skill.damage },
      stats: { ...s.skill.stats },
    })),
    enemies: actors.filter((a) => a.team === "enemy").length,
    actors,
    volumes: world.volumes.items
      .filter((v) => v.alive)
      .map((v) => ({
        id: v.id,
        kind: v.kind,
        vfx: v.vfx,
        team: v.team,
        x: v.x,
        y: v.y,
        r: v.radius,
        warnTicksLeft: Math.max(0, v.bornTick + v.warnTicks - world.tick),
      })),
    counters: {
      eventOverflow: world.events.overflow,
      droppedSpawns: world.report.droppedSpawns,
      droppedVolumes: world.report.droppedVolumes,
    },
  };
}
