import Phaser from "phaser";
import type { Content } from "@/content/types";
import type { MeshDraw } from "@/realtime/present/anim/mesh-pose";
import type { Viewport } from "@/realtime/present/camera";
import { hex } from "@/realtime/present/fx/emit";
import type { FxPool } from "@/realtime/present/fx/pool";
import type { HeadDraw } from "@/realtime/present/fx/recipes/projectile";
import { depthFor } from "@/realtime/present/layers";
import type { WarningDraw } from "@/realtime/present/spawn-warnings";
import type { TelegraphDraw } from "@/realtime/present/telegraphs";
import { type AimDraw, AimView } from "@/realtime/render/aim-view";
import { drawFloor } from "@/realtime/render/floor";
import { FxView } from "@/realtime/render/fx-view";
import { MeshView } from "@/realtime/render/mesh-view";
import { SpawnWarningView } from "@/realtime/render/spawn-warning-view";
import { TelegraphView } from "@/realtime/render/telegraph-view";

export interface RenderFrame {
  view: Viewport;
  camX: number;
  camY: number;
  t: number;
  actors: readonly MeshDraw[];
  actorCount: number;
  heads: readonly HeadDraw[];
  headCount: number;
  pool: FxPool;
  warnings: readonly WarningDraw[];
  warningCount: number;
  telegraphs: readonly TelegraphDraw[];
  telegraphCount: number;
  playerX: number;
  playerY: number;
  aim: AimDraw | null;
}

/** The only Phaser scene. It keeps display objects and copies draw data onto them. */
export class WorldScene extends Phaser.Scene {
  /** The app's per-frame callback, run before Phaser renders (rAF time in ms). */
  onFrame: (timeMs: number) => void = () => {};
  /** Phaser's last render, prerender to postrender (ms): the perf meter's render time. */
  renderMs = 0;
  private readonly bootContent: Content;
  private readonly ready: (scene: WorldScene) => void;
  private readonly fail: (err: Error) => void;
  private content: Content;
  private actors: MeshView[] = [];
  private fx: FxView | null = null;
  private aimView: AimView | null = null;
  private warningView: SpawnWarningView | null = null;
  private telegraphView: TelegraphView | null = null;
  private clearing: Phaser.GameObjects.Image | null = null;

  constructor(content: Content, ready: (scene: WorldScene) => void, fail: (err: Error) => void) {
    super({ key: "world" });
    this.bootContent = content;
    this.content = content;
    this.ready = ready;
    this.fail = fail;
  }

  preload(): void {
    const { atlas } = this.bootContent.look.sprites;
    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      this.fail(
        new Error(`could not load ${file.src}; run pnpm atlas (images) or pnpm sounds (audio)`),
      );
    });
    this.load.atlas(
      "game",
      `${import.meta.env.BASE_URL}${atlas.png}`,
      `${import.meta.env.BASE_URL}${atlas.json}`,
    );
    for (const s of this.bootContent.look.soundManifest.sounds) {
      this.load.audio(s.id, `${import.meta.env.BASE_URL}${s.file}`);
    }
  }

  create(): void {
    const { sprites } = this.bootContent.look;
    const tex = this.textures.get("game");
    const wanted = [...sprites.sprites.map((s) => s.frame), ...sprites.fx.flatMap((f) => f.frames)];
    const missing = wanted.filter((f) => !tex.has(f));
    if (missing.length > 0) {
      this.fail(
        new Error(`public/atlas/game.json lacks frames ${missing.join(", ")}; run pnpm atlas`),
      );
      return;
    }
    this.softEllipse("shadow", 0x000000);
    this.softEllipse("clearing", 0xffffff);
    let renderFrom = 0;
    this.game.events.on(Phaser.Core.Events.PRE_RENDER, () => {
      renderFrom = performance.now();
    });
    this.game.events.on(Phaser.Core.Events.POST_RENDER, () => {
      this.renderMs = performance.now() - renderFrom;
    });
    this.ready(this);
  }

  update(time: number): void {
    this.onFrame(time);
  }

  /** A soft-edged ellipse texture, drawn once (shadows are black; the clearing is tinted). */
  private softEllipse(key: string, color: number): void {
    const t = this.textures.createCanvas(key, 128, 64);
    if (t === null) throw new Error(`could not create the ${key} texture`);
    const ctx = t.getContext();
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    const rgb = `${(color >> 16) & 255}, ${(color >> 8) & 255}, ${color & 255}`;
    g.addColorStop(0, `rgba(${rgb}, 1)`);
    g.addColorStop(0.6, `rgba(${rgb}, 0.8)`);
    g.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.setTransform(1, 0, 0, 0.5, 0, 0);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    t.refresh();
  }

  /** Fresh display objects for a new wave (or new look content). */
  startWave(content: Content, view: Viewport): void {
    this.clearWave();
    this.content = content;
    const { camera, palette, layers } = content.look;
    this.cameras.main.setBackgroundColor(palette.colors[camera.background]);
    drawFloor(this, content, 1);
    this.clearing = this.add
      .image(0, 0, "clearing")
      .setDisplaySize(camera.clearing.width, camera.clearing.height)
      .setAlpha(camera.clearing.alpha)
      .setTint(hex(palette.colors[camera.clearing.color]))
      .setDepth(depthFor(layers, "clearing", 0));
    this.fx = new FxView(this, content);
    this.aimView = new AimView(this);
    this.warningView = new SpawnWarningView(this, content);
    this.telegraphView = new TelegraphView(this, content);
    this.resize(view);
  }

  resize(view: Viewport): void {
    this.scale.resize(view.width, view.height);
    this.scale.setZoom(1 / view.dpr);
    this.cameras.main.setZoom(view.zoom);
  }

  draw(f: RenderFrame): void {
    if (
      this.fx === null ||
      this.aimView === null ||
      this.warningView === null ||
      this.telegraphView === null ||
      this.clearing === null
    ) {
      throw new Error("WorldScene.draw before startWave");
    }
    const { content } = this;
    const flash = hex(content.look.palette.colors[content.look.feedback.hitFlash.color]);
    this.cameras.main.centerOn(f.camX, f.camY);
    for (let i = 0; i < f.actorCount; i++) {
      const d = f.actors[i];
      if (i === this.actors.length) this.actors.push(new MeshView(this, d));
      else if (!this.actors[i].shows(d)) {
        this.actors[i].destroy();
        this.actors[i] = new MeshView(this, d);
      }
      this.actors[i].apply(d, content.look.layers, flash);
    }
    for (let i = f.actorCount; i < this.actors.length; i++) this.actors[i].hide();
    this.clearing.setPosition(f.playerX, f.playerY);
    this.fx.draw(f.pool, f.t, f.heads, f.headCount);
    this.aimView.draw(content, f.aim);
    this.warningView.draw(content, f.warnings, f.warningCount);
    this.telegraphView.draw(content, f.telegraphs, f.telegraphCount);
  }

  clearWave(): void {
    for (const a of this.actors) a.destroy();
    this.actors = [];
    this.children.removeAll(true);
    this.fx = null;
    this.aimView = null;
    this.warningView = null;
    this.telegraphView = null;
    this.clearing = null;
  }
}
