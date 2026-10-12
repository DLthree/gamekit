import type { Push } from "@/content/errors";
import type { Content } from "@/content/types";
import { BEHAVIORS } from "@/game/behaviors";
import { checkLook } from "@/realtime/content/check-look";
import { treeProblems } from "@/realtime/content/check-tree";
import { hasSkillStat, type SkillStatId } from "@/realtime/content/skill-stats";
import { checkStages } from "@/realtime/content/stages";

function checkSkills(c: Content, push: Push): void {
  for (const [id, skill] of Object.entries(c.sim.skills)) {
    const file = `skills/${id}.json`;
    if (skill.activation === "auto" && skill.stats.rate === undefined) {
      push(file, "stats.rate", "required by auto activation");
    }
    if (skill.activation === "manual" && skill.stats.cooldown === undefined) {
      push(file, "stats.cooldown", "required by manual activation");
    }
    if (skill.activation === "manual" && skill.target !== "aim") {
      push(file, "target", "manual skills target aim");
    }
    if (skill.activation === "auto" && skill.target === "aim") {
      push(file, "target", "auto skills target nearest or player");
    }
    const has = (stat: SkillStatId) => hasSkillStat(skill.stats, stat, [], skill.tags);
    // The skill file's own base value. Mods can't take the resolved stat below the zone floor:
    // STAT_CLAMPS' minimums meet it (src/realtime/sim/stats/resolve.test.ts).
    const get = (stat: SkillStatId) => skill.stats[stat];
    for (const p of treeProblems(c, skill.deliver, has, get)) {
      push(file, p.stat === null ? p.path : `stats.${p.stat}`, p.message);
    }
  }
}

function checkEnemies(c: Content, push: Push): void {
  const sprites = c.look.sprites.sprites;
  for (const [id, enemy] of Object.entries(c.sim.enemies)) {
    const file = `enemies/${id}.json`;
    for (const [i, skillId] of enemy.skills.entries()) {
      const skill = c.sim.skills[skillId];
      if (skill === undefined) push(file, `skills.${i}`, `no skill ${skillId}`);
      else if (skill.activation !== "auto" || skill.target !== "player") {
        push(file, `skills.${i}`, `${skillId} is not an enemy skill (auto, target player)`);
      }
    }
    if (enemy.behavior.kind === "game" && !Object.hasOwn(BEHAVIORS, enemy.behavior.id)) {
      const known = Object.keys(BEHAVIORS).join(", ") || "none";
      push(
        file,
        "behavior.id",
        `no game behaviour ${enemy.behavior.id} (src/game/behaviors.ts has ${known})`,
      );
    }
    if (enemy.behavior.kind === "keepDistance") {
      // keepDistance rests up to a centre gap of distance × 1.1; casting checks the edge gap
      // (playerGap, combat/targeting.ts), which is smaller by both radii. Requiring range at
      // least that far out is conservative enough to hold regardless of either actor's radius.
      const { distance } = enemy.behavior;
      const reach = distance * 1.1;
      const inRange = enemy.skills.some((skillId) => {
        const skill = c.sim.skills[skillId];
        return skill !== undefined && skill.stats.range >= reach;
      });
      if (!inRange) {
        push(
          file,
          "behavior.distance",
          `no skill has range ≥ ${reach}; this enemy would never attack`,
        );
      }
    }
    const creature = c.look.creatures.creatures[enemy.look];
    if (creature === undefined) {
      push(file, "look", `no creature ${enemy.look} in look/creatures.json`);
      continue;
    }
    const sprite = sprites.find((s) => s.id === creature.sprite);
    if (sprite !== undefined && sprite.role !== enemy.role) {
      push(
        file,
        "look",
        `sprite ${sprite.id} is drawn for ${sprite.role}, the enemy is ${enemy.role}`,
      );
    }
  }
}

function checkArena(c: Content, push: Push): void {
  const { arena } = c.sim.rules;
  const cam = c.look.camera;
  const file = "rules/arena.json";
  const halfDiagonal =
    (cam.shortSideSpan / 2) * Math.hypot(1, cam.maxAspect) + Math.abs(cam.focusOffsetY);
  if (arena.spawnRadius < halfDiagonal) {
    push(
      file,
      "spawnRadius",
      `at least ${Math.ceil(halfDiagonal)} (the camera's half-diagonal at maxAspect, so spawns stay off screen)`,
    );
  }
  const smaller = Math.min(arena.halfWidth, arena.halfHeight);
  if (arena.spawnRadius > smaller) {
    push(file, "spawnRadius", `at most ${smaller} (the arena's smaller half extent)`);
  }
}

/** Rules that span the real-time layer's files (REALTIME_KINDS); a real-time game's checkGame runs them. */
export function checkRealtime(c: Content, push: Push): void {
  checkSkills(c, push);
  checkEnemies(c, push);
  checkArena(c, push);
  checkStages(c, push);
  checkLook(c, push);
}
