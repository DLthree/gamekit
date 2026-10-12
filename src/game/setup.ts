import type { SourcedMod } from "@/content/schema/vocab";
import type { SimContent } from "@/content/types";
import { ticks } from "@/core/clock";
import { checkTunnelling, enemyTemplates, playerSkills } from "@/game/loadout";
import { createReport } from "@/game/report";
import { checkScenario, type Scenario } from "@/game/scenario";
import { createStageState } from "@/sim/stage";
import { resolveActorStats } from "@/sim/stats/resolve";
import { createWorld, type World } from "@/sim/world";

/**
 * A world for one cell: the character at its build tier against the threat tier's wave. On a
 * stage the threat only sets the enemies' stats: the stage's actors replace its wave, an unarmed
 * player carries no skills, and the stage's duration replaces the wave's.
 */
export function worldFor(scenario: Scenario, content: SimContent): World {
  checkScenario(scenario, content);
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
  const stats = resolveActorStats(character.stats, buildMods);
  const skills = playerSkills(
    content,
    scenario.character,
    scenario.buildTier,
    buildMods,
    buildSource,
  );
  checkTunnelling(skills, templates, buildSource);
  const stage = scenario.stage === undefined ? null : content.stages[scenario.stage];
  return createWorld(content, {
    scenario,
    seed: scenario.seed,
    player: { def: scenario.character, stats, skills: stage?.armed === false ? [] : skills },
    templates,
    maxEnemies: threat.maxAlive,
    durationTicks: ticks(stage?.durationS ?? threat.durationS),
    wave: { elapsed: 0, carry: threat.spawns.map(() => 0), pending: [] },
    report: createReport(stats.life),
    ...(stage === null || scenario.stage === undefined
      ? {}
      : { stage: { state: createStageState(scenario.stage, stage), hold: stage.hold } }),
  });
}
