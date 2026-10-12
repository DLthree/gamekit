import type { SimContent } from "@/content/types";

/** A loadable setup: the type URLs, tests and error reports share. */
export interface Scenario {
  character: string;
  buildTier: number;
  threatTier: number;
  seed: number;
  /** URL override patches, e.g. "skills/fireball.stats.area=55" (content/overrides.ts). */
  overrides: readonly string[];
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
  return `${s.character} build ${s.buildTier} × threat ${s.threatTier}, seed ${s.seed}${o}`;
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
  if (!Number.isInteger(s.seed) || s.seed < 0) {
    throw new ScenarioError(`seed ${s.seed} must be a non-negative integer`);
  }
}
