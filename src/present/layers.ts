import type { Band, Layers } from "@/content/schema/look";

/** Depth distance between bands; y-sorted bands add feet y (arena coordinates stay within ±5000). */
export const BAND_STEP = 10_000;

export function depthFor(layers: Layers, band: Band, y: number): number {
  const i = layers.bands.indexOf(band);
  if (i === -1) throw new Error(`band ${band} is not in look/layers.json`);
  return i * BAND_STEP + (layers.ySorted.includes(band) ? y + BAND_STEP / 2 : 0);
}
