import { checkLook } from "@/content/check-look";
import { type Push, treeProblems } from "@/content/check-tree";
import type { ContentError } from "@/content/errors";
import { hasSkillStat, type SkillStatId } from "@/content/skill-stats";
import type { Content } from "@/content/types";
import { checkGame, checkGameResolved } from "@/game/check";

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
    // STAT_CLAMPS' minimums meet it (src/sim/stats/resolve.test.ts).
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

/** Rules that span files, the kit's and then the game's. Every error is collected, not just the first. */
export function checkContent(c: Content): ContentError[] {
  const errors: ContentError[] = [];
  const push: Push = (file, path, message) => {
    errors.push({ file, path, message });
  };
  checkSkills(c, push);
  checkEnemies(c, push);
  checkArena(c, push);
  checkLook(c, push);
  checkGame(c, push);
  // Resolves the sim's numbers, so only once the rest holds.
  if (errors.length === 0) checkGameResolved(c, push);
  return errors;
}
