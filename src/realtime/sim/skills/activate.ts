import { ticks } from "@/core/clock";
import { unit, type Vec } from "@/core/vec";
import type { Actor } from "@/realtime/sim/actors/store";
import { nearestEnemy, playerGap } from "@/realtime/sim/combat/targeting";
import { type SkillInstance, skillStat } from "@/realtime/sim/skills/instance";
import { playerOf, type World } from "@/realtime/sim/world";

function facingOf(a: Actor): Vec {
  return { x: a.facing, y: 0 };
}

function towards(a: Actor, x: number, y: number): Vec {
  return unit(x - a.x, y - a.y, facingOf(a));
}

/** `range` from the caster along `dir`: the target point of an aimed (or quick-cast) skill. */
function alongAim(caster: Actor, inst: SkillInstance, dir: Vec): Vec {
  const range = skillStat(inst.skill, "range");
  return { x: caster.x + dir.x * range, y: caster.y + dir.y * range };
}

/** Casts `inst` along `dir` at the target point `at`; an owner-bound telegraph holds its caster. */
function fire(world: World, caster: Actor, inst: SkillInstance, dir: Vec, at: Vec): void {
  inst.readyTick = world.tick + inst.skill.intervalTicks;
  const root = inst.skill.deliver;
  if (root.do === "burst" && root.cancelOnOwnerDeath) {
    caster.holdUntilTick = world.tick + ticks(root.warn) + 1;
  }
  world.events.push({
    t: "cast",
    tick: world.tick,
    caster: caster.id,
    casterDef: caster.def,
    team: caster.team,
    skill: inst.skill.id,
    ax: dir.x,
    ay: dir.y,
  });
  world.deliveries.push({
    skill: inst.skill,
    node: inst.skill.deliver,
    owner: caster.id,
    ownerDef: caster.def,
    team: caster.team,
    x: caster.x,
    y: caster.y,
    dirX: dir.x,
    dirY: dir.y,
    tx: at.x,
    ty: at.y,
  });
}

function autoSkill(world: World, caster: Actor, inst: SkillInstance, player: Actor): void {
  if (world.tick < inst.readyTick) return;
  const range = skillStat(inst.skill, "range");
  switch (inst.skill.def.target) {
    case "nearest": {
      const t = nearestEnemy(world, caster.x, caster.y, range);
      if (t !== null) fire(world, caster, inst, towards(caster, t.x, t.y), t);
      return;
    }
    case "player":
      if (player.hp > 0 && playerGap(caster, player) <= range) {
        fire(world, caster, inst, towards(caster, player.x, player.y), player);
      }
      return;
    case "aim":
      throw new Error(`auto skill ${inst.skill.id} targets aim (the content check forbids this)`);
  }
}

function manualSkill(world: World, caster: Actor, inst: SkillInstance): void {
  const cast = world.cast;
  if (cast === null || cast.slot !== inst.slot || world.tick < inst.readyTick) return;
  let dir: Vec;
  if (cast.aim === "auto") {
    const t = nearestEnemy(world, caster.x, caster.y, skillStat(inst.skill, "range"));
    dir = t === null ? facingOf(caster) : towards(caster, t.x, t.y);
  } else {
    dir = unit(cast.aim.x, cast.aim.y, facingOf(caster));
  }
  fire(world, caster, inst, dir, alongAim(caster, inst, dir));
}

/**
 * Phase 2 (skills): auto skills pick targets; the player's cast request fires its slot if ready.
 * The request is consumed this tick either way: a cast during cooldown is dropped, not buffered.
 */
export function thinkSkills(world: World): void {
  const player = playerOf(world);
  for (const a of world.actors.items) {
    if (!a.alive || a.hp <= 0) continue;
    for (const inst of a.skills) {
      if (inst.skill.def.activation === "auto") autoSkill(world, a, inst, player);
      else if (a === player) manualSkill(world, a, inst);
    }
  }
  world.cast = null;
}
