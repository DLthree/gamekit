import Phaser from "phaser";
import type { Layers } from "@/content/schema/look";
import type { ActorDraw } from "@/present/anim/pose";
import { depthFor } from "@/present/layers";

/** One creature image and its shadow. */
export class ActorView {
  private readonly image: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    this.shadow = scene.add.image(0, 0, "shadow").setVisible(false);
    this.image = scene.add.image(0, 0, "game").setVisible(false);
  }

  apply(d: ActorDraw, layers: Layers, flashColor: number): void {
    this.image
      .setVisible(d.visible)
      .setFrame(d.frame)
      .setOrigin(d.originX, d.originY)
      .setPosition(d.x, d.y)
      .setScale(d.scaleX, d.scaleY)
      .setRotation(d.rot)
      .setAlpha(d.alpha)
      .setDepth(d.depth);
    // Phaser 4 replaced setTintFill with a tint mode: FILL paints the flash colour flat.
    if (d.flash) this.image.setTint(flashColor).setTintMode(Phaser.TintModes.FILL);
    else this.image.setTint(0xffffff).setTintMode(Phaser.TintModes.MULTIPLY);
    this.shadow
      .setVisible(d.visible)
      .setPosition(d.shadowX, d.shadowY)
      .setDisplaySize(d.shadowW, d.shadowH)
      .setAlpha(d.shadowAlpha)
      .setDepth(depthFor(layers, "shadows", d.shadowY));
  }

  hide(): void {
    this.image.setVisible(false);
    this.shadow.setVisible(false);
  }

  destroy(): void {
    this.image.destroy();
    this.shadow.destroy();
  }
}
