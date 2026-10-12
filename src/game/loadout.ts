import { type AppliedModifier, mergeSkill, nodesOf } from "@/content/loadout";
import type { SourcedMod } from "@/content/schema/vocab";
import type { SimContent } from "@/content/types";
import { TICK_S } from "@/core/clock";
import { ScenarioError } from "@/game/scenario";
import { resolveSkill, type SkillInstance, skillStat } from "@/sim/skills/instance";
import { resolveActorStats } from "@/sim/stats/resolve";
import type { EnemyTemplate } from "@/sim/world";

/** Every enemy kind with the threat tier's StatMods applied (enemy skills take no modifiers). */
export function enemyTemplates(
  content: SimContent,
  enemyMods: readonly SourcedMod[],
): Record<string, EnemyTemplate> {
  const templates: Record<string, EnemyTemplate> = {};
  for (const [id, enemy] of Object.entries(content.enemies)) {
    const skills = enemy.skills.map((s) =>
      resolveSkill(mergeSkill(s, content.skills[s], [], {}), enemyMods),
    );
    templates[id] = { role: enemy.role, stats: resolveActorStats(enemy.stats, enemyMods), skills };
  }
  return templates;
}

/** A character's skills at a build tier: each slot merged with its modifiers and look. */
export function playerSkills(
  content: SimContent,
  characterId: string,
  buildTier: number,
  buildMods: readonly SourcedMod[],
  source: string,
): SkillInstance[] {
  const character = content.characters[characterId];
  const tier = content.builds[characterId].tiers[buildTier - 1];
  const out: SkillInstance[] = [];
  for (const slot of character.slots) {
    const entry = tier.loadout[slot.id];
    if (entry === undefined) throw new Error(`${source}: slot ${slot.id} is empty`);
    const applied: AppliedModifier[] = entry.modifiers.map((id) => ({
      id,
      def: content.modifiers[id],
    }));
    const merged = mergeSkill(entry.skill, content.skills[entry.skill], applied, tier.look);
    out.push({ skill: resolveSkill(merged, buildMods), slot: slot.id, readyTick: 0 });
  }
  return out;
}

/**
 * Projectiles are hit-tested at the end of each tick's step, so a step longer than twice their
 * reach (own radius + the smallest enemy's) can skip a body. Stop instead of sweeping: no shipped
 * skill is near this; swept collision waits until one is. Returns the first skill over the
 * bound, described, or null. The content check runs it for every build tier × threat; world
 * creation asserts it.
 */
export function tunnellingProblem(
  skills: readonly SkillInstance[],
  templates: Readonly<Record<string, EnemyTemplate>>,
): string | null {
  let smallest = Number.POSITIVE_INFINITY;
  for (const t of Object.values(templates)) smallest = Math.min(smallest, t.stats.radius);
  for (const { skill } of skills) {
    for (const node of nodesOf(skill.deliver, "projectile")) {
      const step = skillStat(skill, "projectileSpeed") * TICK_S;
      const reach = 2 * (node.radius + smallest);
      if (step > reach) {
        return `${skill.id} projectiles move ${step.toFixed(1)} a tick, more than ${reach} (twice their radius plus the smallest enemy's), so they could pass through enemies between hit tests`;
      }
    }
  }
  return null;
}

/** tunnellingProblem as a ScenarioError, prefixed with the build tier it came from. */
export function checkTunnelling(
  skills: readonly SkillInstance[],
  templates: Readonly<Record<string, EnemyTemplate>>,
  source: string,
): void {
  const problem = tunnellingProblem(skills, templates);
  if (problem !== null) throw new ScenarioError(`${source}: ${problem}`);
}
