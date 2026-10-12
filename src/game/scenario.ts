import type { SimContent } from "@/content/types";
import { parseUrl } from "@/game/url";

/** A loadable setup: the type URLs, tests and error reports share. */
export interface Scenario {
  character: string;
  buildTier: number;
  threatTier: number;
  seed: number;
  /** URL override patches, e.g. "skills/fireball.stats.area=55" (content/overrides.ts). */
  overrides: readonly string[];
  /** A bench (content/stages) in place of the threat's wave; its cell is the stage's `from`. */
  stage?: string;
}

/** A scenario the content can't provide. Shown on the error panel, never papered over. */
export class ScenarioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScenarioError";
  }
}

export function scenarioLabel(s: Scenario): string {
  const o = s.overrides.length > 0 ? ` o=${s.overrides.join(" o=")}` : "";
  const cell = `${s.character} build ${s.buildTier} × threat ${s.threatTier}`;
  const what = s.stage === undefined ? cell : `stage ${s.stage} (${cell})`;
  return `${what}, seed ${s.seed}${o}`;
}

/** The scenario of stage `id`: the cell its `from` address names, playing the stage. */
export function stageScenario(
  content: SimContent,
  id: string,
  seed: number,
  overrides: readonly string[],
): Scenario {
  const stage = content.stages[id];
  if (stage === undefined)
    throw new ScenarioError(
      `no stage ${id}; content/stages has ${Object.keys(content.stages).join(", ") || "none"}`,
    );
  const from = parseUrl(stage.from);
  if (from.target?.screen !== "cell")
    throw new ScenarioError(
      `stages/${id}.json from: ${stage.from} is not a cell (char, build and threat)${from.errors.length > 0 ? `: ${from.errors.join("; ")}` : ""}`,
    );
  return { ...from.target.cell, seed, overrides, stage: id };
}

export function checkScenario(s: Scenario, content: SimContent): void {
  if (!Object.hasOwn(content.characters, s.character)) {
    throw new ScenarioError(
      `no character ${s.character}; content/characters has ${Object.keys(content.characters).join(", ")}`,
    );
  }
  const tiers = content.builds[s.character].tiers.length;
  if (!Number.isInteger(s.buildTier) || s.buildTier < 1 || s.buildTier > tiers) {
    throw new ScenarioError(
      `builds/${s.character}.json has ${tiers} tiers; build tier ${s.buildTier} is not authored`,
    );
  }
  if (!Object.hasOwn(content.threats, `tier-${s.threatTier}`)) {
    throw new ScenarioError(`threats/tier-${s.threatTier}.json does not exist`);
  }
  if (s.stage !== undefined && !Object.hasOwn(content.stages, s.stage)) {
    throw new ScenarioError(`no stage ${s.stage} in content/stages`);
  }
  if (!Number.isInteger(s.seed) || s.seed < 0) {
    throw new ScenarioError(`seed ${s.seed} must be a non-negative integer`);
  }
}
