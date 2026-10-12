import { spawnActor } from "@/realtime/sim/actors/store";
import { spawnVolume, type VolumeInit } from "@/realtime/sim/volumes/store";
import type { World } from "@/realtime/sim/world";

export interface EnemySpawn {
  def: string;
  x: number;
  y: number;
  /** A stage place (src/realtime/sim/stage.ts) this enemy fills; it learns the actor's id. */
  stageSlot?: number;
}

/** Everything that joins the world waits here until the last phase of the tick. */
export interface SpawnQueue {
  enemies: EnemySpawn[];
  volumes: VolumeInit[];
}

export function createSpawnQueue(): SpawnQueue {
  return { enemies: [], volumes: [] };
}

export function queueEnemy(world: World, def: string, x: number, y: number): void {
  world.spawns.enemies.push({ def, x, y });
}

export function queueVolume(world: World, init: VolumeInit): void {
  world.spawns.volumes.push(init);
}

/** Phase 10: spawns what's queued, applying the store capacities and the world's maxEnemies. */
export function drainSpawns(world: World): void {
  const { actors, volumes, events, report, tick } = world;
  for (const s of world.spawns.enemies) {
    if (!Object.hasOwn(world.templates, s.def)) {
      throw new Error(`tick ${tick}: no enemy template "${s.def}" (content/enemies/${s.def}.json)`);
    }
    const t = world.templates[s.def];
    const enemiesAlive = actors.alive - 1;
    const a =
      enemiesAlive >= world.maxEnemies
        ? null
        : spawnActor(actors, {
            def: s.def,
            team: "enemy",
            role: t.role,
            x: s.x,
            y: s.y,
            radius: t.stats.radius,
            hp: t.stats.life,
            moveSpeed: t.stats.moveSpeed,
            knockbackResist: t.stats.knockbackResist,
            skills: t.skills.map((skill) => ({ skill, slot: null, readyTick: 0 })),
          });
    if (a === null) {
      report.droppedSpawns += 1;
      continue;
    }
    if (s.stageSlot !== undefined) {
      const slot = world.stage?.slots[s.stageSlot];
      if (slot === undefined) throw new Error(`tick ${tick}: no stage place ${s.stageSlot}`);
      slot.id = a.id;
    }
    events.push({
      t: "spawned",
      tick,
      id: a.id,
      def: a.def,
      role: a.role,
      team: a.team,
      x: a.x,
      y: a.y,
    });
    report.peakAlive = Math.max(report.peakAlive, actors.alive - 1);
  }
  world.spawns.enemies.length = 0;
  for (const init of world.spawns.volumes) {
    const v = spawnVolume(volumes, init, tick);
    if (v === null) {
      report.droppedVolumes += 1;
      continue;
    }
    events.push({
      t: "volumeStarted",
      tick,
      id: v.id,
      kind: v.kind,
      vfx: v.vfx,
      team: v.team,
      owner: v.owner,
      ownerDef: v.ownerDef,
      x: v.x,
      y: v.y,
      r: v.radius,
      halfAngle: v.halfAngle,
      dirX: v.dirX,
      dirY: v.dirY,
      lifeTicks: v.lifeTicks,
      shape: v.shape,
      length: v.length,
      warnTicks: v.warnTicks,
      ox: v.ox,
      oy: v.oy,
    });
  }
  world.spawns.volumes.length = 0;
}
