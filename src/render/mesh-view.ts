import Phaser from "phaser";
import type { Layers } from "@/content/schema/look";
import { setGridUV } from "@/present/anim/layer2";
import type { MeshDraw } from "@/present/anim/mesh-pose";
import { depthFor } from "@/present/layers";

/** Mesh2D has `tint` and `tintMode` at runtime (spike 3 flashes with them); 4.2.1's typings omit them. */
interface Tintable {
  tint: number;
  tintMode: number;
}

/**
 * A bent creature: a Mesh2D over the atlas frame, whose vertex array is the grid's (rewritten by
 * deformGrid every frame), plus its shadow and its prop image, which flashes with the body.
 */
export class MeshView {
  private readonly mesh: Phaser.GameObjects.Mesh2D;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly prop: Phaser.GameObjects.Image | null;
  private readonly vertices: number[];

  constructor(scene: Phaser.Scene, d: MeshDraw) {
    const f = scene.textures.getFrame("game", d.body.frame);
    // The grid maps the frame's full UV rectangle: a rotated or trimmed atlas frame would bend
    // a skewed or mis-sized body with no error, so refuse it.
    if (f.rotated || f.trimmed)
      throw new Error(
        `mesh body ${d.body.frame}: rotated or trimmed atlas frames aren't supported`,
      );
    // setGridUV writes this view's UVs into the MeshDraw's grid (one view per grid).
    setGridUV(d.grid, f.u0, f.v0, f.u1, f.v1);
    this.vertices = d.grid.vertices;
    this.shadow = scene.add.image(0, 0, "shadow").setVisible(false);
    this.mesh = scene.add.mesh2d(0, 0, "game", d.grid.vertices, d.grid.indices);
    this.mesh.buildOrderedIndices(2, true);
    this.prop = d.prop === null ? null : scene.add.image(0, 0, "game", d.prop.frame);
  }

  /** Whether this view is built on `d`'s grid (a new grid needs a new Mesh2D). */
  shows(d: MeshDraw): boolean {
    return d.grid.vertices === this.vertices;
  }

  apply(d: MeshDraw, layers: Layers, flashColor: number): void {
    const b = d.body;
    this.mesh
      .setVisible(b.visible)
      .setPosition(b.x, b.y)
      .setScale(b.scaleX, b.scaleY)
      .setRotation(b.rot)
      .setAlpha(b.alpha)
      .setDepth(b.depth);
    const tint = this.mesh as unknown as Tintable;
    tint.tint = b.flash ? flashColor : 0xffffff;
    tint.tintMode = b.flash ? Phaser.TintModes.FILL : Phaser.TintModes.MULTIPLY;
    this.shadow
      .setVisible(b.visible)
      .setPosition(b.shadowX, b.shadowY)
      .setDisplaySize(b.shadowW, b.shadowH)
      .setAlpha(b.shadowAlpha)
      .setDepth(depthFor(layers, "shadows", b.shadowY));
    const p = d.prop;
    if (this.prop === null || p === null) return;
    this.prop
      .setVisible(b.visible)
      .setFrame(p.frame)
      .setOrigin(p.originX, p.originY)
      .setPosition(p.x, p.y)
      .setScale(p.scaleX, p.scaleY)
      .setRotation(p.rot)
      .setAlpha(b.alpha)
      .setDepth(p.depth);
    // The prop flashes with the body, as the body's own tint does above.
    if (b.flash) this.prop.setTint(flashColor).setTintMode(Phaser.TintModes.FILL);
    else this.prop.setTint(0xffffff).setTintMode(Phaser.TintModes.MULTIPLY);
  }

  hide(): void {
    this.mesh.setVisible(false);
    this.shadow.setVisible(false);
    this.prop?.setVisible(false);
  }

  destroy(): void {
    this.mesh.destroy();
    this.shadow.destroy();
    this.prop?.destroy();
  }
}
