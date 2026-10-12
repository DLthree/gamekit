import type Phaser from "phaser";
import type { Content } from "@/content/types";
import { hex } from "@/realtime/present/fx/emit";
import { depthFor } from "@/realtime/present/layers";

/** The aim indicator while the skill button is dragged: a line to the skill's range and its area. */
export interface AimDraw {
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  length: number;
  radius: number;
  cancel: boolean;
  /** False while the cast skill is on cooldown; strokes with `cooldownColor` instead of `color`. */
  ready: boolean;
}

export class AimView {
  private readonly g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics();
  }

  draw(content: Content, aim: AimDraw | null): void {
    this.g.clear();
    if (aim === null || aim.cancel) return;
    const look = content.look.controls.aim;
    const colorName = aim.ready ? look.color : look.cooldownColor;
    const color = hex(content.look.palette.colors[colorName]);
    const ex = aim.x + aim.dirX * aim.length;
    const ey = aim.y + aim.dirY * aim.length;
    this.g.setDepth(depthFor(content.look.layers, "aim", 0));
    this.g.lineStyle(look.width, color, look.alpha).lineBetween(aim.x, aim.y, ex, ey);
    this.g.strokeCircle(ex, ey, aim.radius);
  }
}
