import type Phaser from "phaser";
import type { Content } from "@/content/types";
import { createRng, nextRange } from "@/core/rng";
import { hex } from "@/present/fx/emit";
import { depthFor } from "@/present/layers";

/** Ink specks over the arena (so camera motion reads) and the arena's inked edge. */
export function drawFloor(
  scene: Phaser.Scene,
  content: Content,
  seed: number,
): Phaser.GameObjects.Graphics {
  const { arena } = content.sim.rules;
  const { camera, palette, layers } = content.look;
  const g = scene.add.graphics().setDepth(depthFor(layers, "floor", 0));
  const rng = createRng(seed);
  const count = Math.round(
    ((arena.halfWidth * 2 * arena.halfHeight * 2) / 10_000) * camera.floor.density,
  );
  g.fillStyle(hex(palette.colors[camera.floor.color]), camera.floor.alpha);
  for (let i = 0; i < count; i++) {
    const x = nextRange(rng, -arena.halfWidth, arena.halfWidth);
    const y = nextRange(rng, -arena.halfHeight, arena.halfHeight);
    g.fillEllipse(x, y, nextRange(rng, 2, 5), nextRange(rng, 1, 2.5));
  }
  g.lineStyle(camera.edge.width, hex(palette.colors[camera.edge.color]), camera.edge.alpha);
  g.strokeRect(-arena.halfWidth, -arena.halfHeight, arena.halfWidth * 2, arena.halfHeight * 2);
  return g;
}
