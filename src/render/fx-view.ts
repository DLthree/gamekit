import type Phaser from "phaser";
import type { FxTexture } from "@/content/schema/sprites";
import type { Content } from "@/content/types";
import { type FxDraw, fxDraw, newFxDraw } from "@/present/fx/look";
import type { FxPool } from "@/present/fx/pool";
import type { HeadDraw } from "@/present/fx/recipes/projectile";
import { depthFor } from "@/present/layers";

const draw: FxDraw = newFxDraw();

/** Sets an image to a frame, sized so its longest side is `w` × `h` world units. */
function place(
  img: Phaser.GameObjects.Image,
  frame: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  img.setFrame(frame);
  const longest = Math.max(img.frame.realWidth, img.frame.realHeight);
  img.setPosition(x, y).setScale(w / longest, h / longest);
}

/**
 * Pool slots and projectile heads → images; images are made on first use and reused. Pool
 * images anchor at their texture's pivot (grass and flames stand on their base); heads spin
 * about their centre.
 */
export class FxView {
  private readonly scene: Phaser.Scene;
  private readonly content: Content;
  /** Fx texture id → its manifest entry, built once per wave (draw runs every frame). */
  private readonly textures: ReadonlyMap<string, FxTexture>;
  private readonly slots: Phaser.GameObjects.Image[] = [];
  private readonly heads: Phaser.GameObjects.Image[] = [];

  constructor(scene: Phaser.Scene, content: Content) {
    this.scene = scene;
    this.content = content;
    this.textures = new Map(content.look.sprites.fx.map((f) => [f.id, f]));
  }

  private textureOf(texture: string): FxTexture {
    const t = this.textures.get(texture);
    if (t === undefined) throw new Error(`no fx texture ${texture} in look/generated/sprites.json`);
    return t;
  }

  private image(list: Phaser.GameObjects.Image[], i: number): Phaser.GameObjects.Image {
    while (list.length <= i) list.push(this.scene.add.image(0, 0, "game").setVisible(false));
    return list[i];
  }

  draw(pool: FxPool, t: number, heads: readonly HeadDraw[], headCount: number): void {
    const { fx, layers } = this.content.look;
    for (const inst of pool.items) {
      const img = this.image(this.slots, inst.slot);
      if (!inst.alive) {
        img.setVisible(false);
        continue;
      }
      const kind = fx.kinds[inst.kind];
      fxDraw(inst, kind, t, draw);
      if (!draw.visible) {
        img.setVisible(false);
        continue;
      }
      const tex = this.textureOf(kind.texture);
      const frames = kind.variants === null ? tex.frames.length : kind.variants;
      place(img, tex.frames[draw.variant % frames], draw.x, draw.y, draw.w, draw.h);
      img
        .setOrigin(tex.pivot[0], tex.pivot[1])
        .setVisible(true)
        .setRotation(draw.rot)
        .setAlpha(draw.alpha)
        .setTint(inst.tint)
        .setDepth(depthFor(layers, kind.band, draw.y));
    }
    for (let i = 0; i < Math.max(headCount, this.heads.length); i++) {
      const img = this.image(this.heads, i);
      if (i >= headCount) {
        img.setVisible(false);
        continue;
      }
      const h = heads[i];
      place(img, this.textureOf(h.texture).frames[h.frame], h.x, h.y, h.size, h.size);
      img
        .setOrigin(0.5, 0.5)
        .setVisible(true)
        .setRotation(h.rot)
        .setAlpha(1)
        .setTint(h.tint)
        .setDepth(depthFor(layers, "fx", h.y));
    }
  }
}
