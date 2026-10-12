import type { SimContent } from "@/content/types";
import { ScenarioError } from "@/game/scenario";

/** Each character's grid is 3 build tiers × 3 threat tiers. */
export const GRID = 3;

export interface PickerCell {
  buildTier: number;
  threatTier: number;
  /** The build tier and the threat file both exist; other cells show but can't be tapped. */
  enabled: boolean;
}

export interface PickerGrid {
  character: string;
  /** Row by row: build tiers down, threat tiers across. */
  cells: PickerCell[];
}

/** One grid per character, or just the one the URL names (an unknown name is a ScenarioError). */
export function pickerModel(content: SimContent, character: string | null): PickerGrid[] {
  const all = Object.keys(content.characters);
  if (character !== null && !all.includes(character)) {
    throw new ScenarioError(`no character ${character}; content/characters has ${all.join(", ")}`);
  }
  return (character === null ? all : [character]).map((c) => {
    const tiers = content.builds[c].tiers.length;
    const cells: PickerCell[] = [];
    for (let buildTier = 1; buildTier <= GRID; buildTier++) {
      for (let threatTier = 1; threatTier <= GRID; threatTier++) {
        const enabled = buildTier <= tiers && Object.hasOwn(content.threats, `tier-${threatTier}`);
        cells.push({ buildTier, threatTier, enabled });
      }
    }
    return { character: c, cells };
  });
}
