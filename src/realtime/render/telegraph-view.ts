import type Phaser from "phaser";
import type { Content } from "@/content/types";
import { hex } from "@/realtime/present/fx/emit";
import { depthFor } from "@/realtime/present/layers";
import { hatchFor, type TelegraphDraw, telegraphVfx } from "@/realtime/present/telegraphs";

/**
 * Enemy telegraphs: parchment halo, ink hatching, ink outline, and the lobbed stone, each on its
 * own pooled Graphics placed and turned to the telegraph, so hatch geometry stays in local space.
 * Colours are palette ink and parchment by construction: never a build colour.
 */
export class TelegraphView {
  private readonly scene: Phaser.Scene;
  private readonly pool: Phaser.GameObjects.Graphics[] = [];
  private readonly depth: number;
  private readonly ink: number;
  private readonly halo: number;

  constructor(scene: Phaser.Scene, content: Content) {
    this.scene = scene;
    const { layers, palette } = content.look;
    this.depth = depthFor(layers, "telegraphs", 0);
    this.ink = hex(palette.colors.ink);
    this.halo = hex(palette.colors.parchment);
  }

  draw(content: Content, draws: readonly TelegraphDraw[], count: number): void {
    while (this.pool.length < count) this.pool.push(this.scene.add.graphics().setDepth(this.depth));
    for (let i = 0; i < this.pool.length; i++) {
      const g = this.pool[i];
      g.clear();
      if (i < count) this.drawOne(g, content, draws[i]);
      else g.setVisible(false);
    }
  }

  private drawOne(g: Phaser.GameObjects.Graphics, content: Content, d: TelegraphDraw): void {
    const v = telegraphVfx(content.look, d.vfx);
    const turn = Math.atan2(d.dirY, d.dirX);
    g.setVisible(true).setPosition(d.x, d.y).setRotation(turn);
    const lane = d.shape === "lane";
    g.lineStyle(v.halo.width, this.halo, v.halo.alpha);
    this.outline(g, d, lane);
    const segs = hatchFor(d, v);
    // A lane grows from its start, clipped at a front; a circle's hatch comes pre-grown.
    const grow = v.fill === "grow" ? d.progress : 1;
    const front = -d.r + grow * (d.length + 2 * d.r);
    g.lineStyle(v.hatch.width, this.ink, v.hatch.alpha).beginPath();
    for (let k = 0; k < segs.length; k += 4) {
      let x0 = segs[k];
      let y0 = segs[k + 1];
      let x1 = segs[k + 2];
      let y1 = segs[k + 3];
      if (lane) {
        if (x0 > front && x1 > front) continue;
        // Cut the part past the front (no tuples: this runs per segment per frame).
        if (x0 > front) {
          y0 = y1 + ((y0 - y1) * (front - x1)) / (x0 - x1);
          x0 = front;
        } else if (x1 > front) {
          y1 = y0 + ((y1 - y0) * (front - x0)) / (x1 - x0);
          x1 = front;
        }
      }
      g.moveTo(x0, y0).lineTo(x1, y1);
    }
    g.strokePath();
    g.lineStyle(v.outline.width, this.ink, v.outline.alpha);
    this.outline(g, d, lane);
    if (d.lob !== null) {
      // The stone is in world space; the Graphics is turned to the telegraph.
      const dx = d.lob.x - d.x;
      const dy = d.lob.y - d.y;
      const c = Math.cos(turn);
      const s = Math.sin(turn);
      g.fillStyle(this.ink, 1).fillCircle(dx * c + dy * s, -dx * s + dy * c, d.lob.size / 2);
    }
  }

  /** Strokes the shape's edge in the current line style (local space: +x along the lane). */
  private outline(g: Phaser.GameObjects.Graphics, d: TelegraphDraw, lane: boolean): void {
    if (!lane) {
      g.strokeCircle(0, 0, d.r);
      return;
    }
    const half = Math.PI / 2;
    g.beginPath()
      .arc(0, 0, d.r, half, 3 * half)
      .lineTo(d.length, -d.r)
      .arc(d.length, 0, d.r, -half, half)
      .closePath()
      .strokePath();
  }
}
