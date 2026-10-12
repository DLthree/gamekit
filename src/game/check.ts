import { achievementProblems } from "@/content/achievements";
import type { Push } from "@/content/errors";
import type { Content } from "@/content/types";
import { checkBuilds, checkModifiers, checkProjectileSteps } from "@/game/check-builds";
import { checkScenario, ScenarioError, stageScenario } from "@/game/scenario";
import { atlasProblems } from "@/realtime/content/atlas";
import { checkRealtime } from "@/realtime/content/check";
import { checkMods } from "@/realtime/content/check-tree";

function checkThreats(c: Content, push: Push): void {
  const smaller = Math.min(c.sim.rules.arena.halfWidth, c.sim.rules.arena.halfHeight);
  const onScreen = c.look.camera.shortSideSpan / 2;
  for (const [id, threat] of Object.entries(c.sim.threats)) {
    const file = `threats/${id}.json`;
    if (!/^tier-[1-9]$/.test(id)) push(file, "", "threat files are named tier-1, tier-2, …");
    checkMods(threat.enemyMods, file, "enemyMods", push);
    const end = `after the wave ends at ${threat.durationS} s`;
    for (const [i, s] of threat.spawns.entries()) {
      if (!Object.hasOwn(c.sim.enemies, s.enemy))
        push(file, `spawns.${i}.enemy`, `no enemy ${s.enemy}`);
      if ("at" in s) {
        if (s.at >= threat.durationS) push(file, `spawns.${i}.at`, end);
      } else {
        if (s.to > threat.durationS) push(file, `spawns.${i}.to`, end);
        if (s.from >= s.to) push(file, `spawns.${i}.from`, "must be before to");
      }
      if (s.pattern === "ring" && s.radius > smaller) {
        push(file, `spawns.${i}.radius`, `at most ${smaller} (the arena's smaller half extent)`);
      }
      if (s.pattern === "field") {
        const at = `spawns.${i}`;
        if (s.minDistance >= s.maxDistance)
          push(file, `${at}.minDistance`, "must be less than maxDistance");
        if (s.maxDistance > onScreen) {
          push(
            file,
            `${at}.maxDistance`,
            `at most ${onScreen} (half of look/camera.json shortSideSpan, so spawns stay on screen)`,
          );
        }
        if (s.maxDistance > smaller)
          push(file, `${at}.maxDistance`, `at most ${smaller} (the arena's smaller half extent)`);
        if (s.at + s.warnS >= threat.durationS) push(file, `${at}.warnS`, end);
      }
    }
  }
}

/** Each stage's `from` is a cell this content has. */
function checkStageCells(c: Content, push: Push): void {
  for (const id of Object.keys(c.sim.stages)) {
    try {
      checkScenario(stageScenario(c.sim, id, 0, []), c.sim);
    } catch (err) {
      if (!(err instanceof ScenarioError)) throw err;
      push(`stages/${id}.json`, "from", err.message);
    }
  }
}

/** Each deed asks for a threat tier the content has, and makes a Steam achievement name. */
function checkDeeds(c: Content, push: Push): void {
  for (const [id, deed] of Object.entries(c.sim.deeds)) {
    const { threat } = deed.needs;
    if (threat !== undefined && !Object.hasOwn(c.sim.threats, `tier-${threat}`))
      push(`deeds/${id}.json`, "needs.threat", `no threats/tier-${threat}.json`);
  }
  for (const { deed, message } of achievementProblems(Object.keys(c.sim.deeds)))
    push(`deeds/${deed}.json`, "", message);
}

/** The game's cross-file rules: builds, the modifiers they use, threats, and stages' cells. */
/** The real-time layer's checks, then the example's own. */
export function checkGame(c: Content, push: Push): void {
  checkRealtime(c, push);
  checkBuilds(c, push);
  checkModifiers(c, push);
  checkThreats(c, push);
  checkStageCells(c, push);
  checkDeeds(c, push);
}

/** Checks that resolve the sim's numbers; they run only on content every other check accepted. */
export function checkGameResolved(c: Content, push: Push): void {
  checkProjectileSteps(c, push);
}

/**
 * Problems with files outside content/ that content names (pnpm content:check, Node only):
 * `readPublic` reads a file under public/, null when missing.
 */
export function checkGameFiles(c: Content, readPublic: (path: string) => string | null): string[] {
  return atlasProblems(c.look.sprites, readPublic);
}
