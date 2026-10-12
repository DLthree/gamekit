import type Phaser from "phaser";
import type { Content } from "@/content/types";
import { hex } from "@/present/fx/emit";
import { depthFor } from "@/present/layers";
import type { WarningDraw } from "@/present/spawn-warnings";

/** Field spawn markers on the ground: an ink ring with a disc filling it until the enemy appears. */
export class SpawnWarningView {
  private readonly g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, content: Content) {
    this.g = scene.add.graphics().setDepth(depthFor(content.look.layers, "ground", 0));
  }

  draw(content: Content, markers: readonly WarningDraw[], count: number): void {
    this.g.clear();
    const look = content.look.feedback.spawnWarning;
    const color = hex(content.look.palette.colors[look.color]);
    for (let i = 0; i < count; i++) {
      const m = markers[i];
      this.g.fillStyle(color, look.fillAlpha).fillCircle(m.x, m.y, m.radius * m.fill);
      this.g.lineStyle(look.width, color, look.alpha).strokeCircle(m.x, m.y, m.radius);
    }
  }
}
