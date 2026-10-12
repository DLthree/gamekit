import type { UrlOptions } from "@/agent/url-options";
import { buildAim } from "@/app/aim";
import { GameLoop } from "@/app/loop";
import type { Content } from "@/content/types";
import { TICK_HZ, tickSeconds } from "@/core/clock";
import type { Vec } from "@/core/vec";
import { BOTS } from "@/game/bots";
import type { WaveReport } from "@/game/report";
import type { Scenario } from "@/game/scenario";
import { worldFor } from "@/game/setup";
import { type ControlElements, type ControlState, Controls } from "@/input/controls";
import type { SkillTrace } from "@/input/skill-button";
import { ActorDraws } from "@/present/anim/actors";
import {
  computeViewport,
  followCamera,
  shakeOffset,
  updateLead,
  type Viewport,
  worldToCss,
} from "@/present/camera";
import { applyEvents } from "@/present/feedback";
import type { HeadDraw } from "@/present/fx/recipes/projectile";
import {
  createPresentation,
  type Presentation,
  swapPresentationLook,
} from "@/present/presentation";
import type { WarningDraw } from "@/present/spawn-warnings";
import type { TelegraphDraw } from "@/present/telegraphs";
import type { AudioOut } from "@/render/audio";
import type { WorldScene } from "@/render/world-scene";
import type { Command } from "@/sim/command";
import type { SimEvent } from "@/sim/events";
import { playerOf, type World } from "@/sim/world";

export interface WaveSetup {
  content: Content;
  scenario: Scenario;
  options: UrlOptions;
  scene: WorldScene;
  audio: AudioOut;
  elements: ControlElements;
  onTrace: (t: SkillTrace) => void;
  onEnded: (report: WaveReport) => void;
}

/** One running wave: world, loop, presentation, controls, and the per-frame draw. */
export class WaveSession {
  readonly world: World;
  readonly loop: GameLoop;
  readonly pres: Presentation;
  /** Every event this wave emitted (agent=1 only). */
  readonly log: SimEvent[] = [];
  private readonly setup: WaveSetup;
  private content: Content;
  private controls: Controls | null;
  private view: Viewport;
  private readonly heads: HeadDraw[] = [];
  private actors = new ActorDraws();
  private readonly warnings: WarningDraw[] = [];
  private readonly telegraphs: TelegraphDraw[] = [];
  /** Telegraphs drawn in the last frame (GameHandle.telegraphs). */
  telegraphCount = 0;

  constructor(s: WaveSetup) {
    this.setup = s;
    this.content = s.content;
    this.world = worldFor(s.scenario, s.content.sim);
    this.pres = createPresentation(s.content, s.scenario.seed);
    this.loop = new GameLoop({
      world: this.world,
      manual: s.options.manual,
      bot: s.options.bot === null ? null : BOTS[s.options.bot],
    });
    this.view = this.measure();
    s.scene.startWave(s.content, this.view);
    this.controls = this.buildControls();
  }

  private buildControls(): Controls | null {
    const s = this.setup;
    if (s.options.bot !== null) return null;
    const { controls, palette } = this.content.look;
    return new Controls({
      elements: s.elements,
      mode: s.options.aim,
      stickRadius: controls.stickRadius,
      stickDeadZone: controls.stickDeadZone,
      buttonRadius: controls.buttonRadius,
      knobRadius: controls.knobRadius,
      cancelColor: palette.colors[controls.cancelColor],
      playerCss: () => this.playerCss(),
      onTrace: s.onTrace,
    });
  }

  /** The player's feet on screen in CSS px: absolute aim's origin. */
  playerCss(): Vec {
    const p = playerOf(this.world);
    return worldToCss(this.pres.camera, this.view, p.x, p.y);
  }

  /**
   * A look-only edit: rebuilds everything the look built at wave start (effects pool,
   * projectile tint tracker, per-actor animation jitter, controls, views) so every field in
   * look/ is honoured live; the world (sim) keeps running unchanged. Rebuilding drops
   * in-flight state tied to the old look — projectile heads mid-flight, per-actor animation
   * phase/rate, death-pop ghosts — which is acceptable: it's a few frames of visual reset for
   * an edit that's supposed to be invisible otherwise, not a wrong or stale look.
   */
  swapLook(content: Content): void {
    this.content = content;
    swapPresentationLook(this.pres, content);
    this.actors = new ActorDraws();
    if (this.controls !== null) this.controls.release();
    this.controls = this.buildControls();
    this.setup.scene.startWave(content, this.view);
  }

  frame(nowS: number): void {
    this.resizeIfNeeded();
    const c = this.controls === null ? null : this.controls.sample();
    if (c !== null && c.cast !== null) this.loop.requestCast(c.cast);
    const events =
      c === null ? this.loop.frame(nowS, 0, 0) : this.loop.frame(nowS, c.moveX, c.moveY);
    this.present(events);
    this.draw(c === null ? null : c.view);
  }

  /**
   * manual=1: exactly n ticks with this command (its cast on the first); presentation follows
   * each tick, so effects spawned mid-batch get their own tick's time.
   */
  step(n: number, command: Command): SimEvent[] {
    const out: SimEvent[] = [];
    for (let i = 0; i < n && !this.loop.ended; i++) {
      const events = this.loop.stepManual(1, i === 0 ? command : { ...command, cast: null });
      this.present(events);
      out.push(...events);
    }
    return out;
  }

  destroy(): void {
    if (this.controls !== null) this.controls.release();
    this.setup.audio.stopLoops();
    this.setup.scene.clearWave();
  }

  private measure(): Viewport {
    const cam = this.content.look.camera;
    const dpr = this.setup.options.dpr ?? window.devicePixelRatio;
    return computeViewport(
      window.innerWidth,
      window.innerHeight,
      dpr,
      cam.dprCap,
      cam.shortSideSpan,
    );
  }

  /** Rotation and resizes take effect the frame they happen. */
  private resizeIfNeeded(): void {
    if (window.innerWidth === this.view.cssWidth && window.innerHeight === this.view.cssHeight)
      return;
    this.view = this.measure();
    this.setup.scene.resize(this.view);
  }

  private present(events: readonly SimEvent[]): void {
    const t = tickSeconds(this.world.tick);
    if (this.setup.options.agent) this.log.push(...events);
    this.pres.sound.running = this.setup.audio.running;
    applyEvents(this.pres, events, t);
    this.pres.tracker.update(this.world, this.pres.em, t);
    this.pres.em.pool.expire(t);
    this.pres.warnings.prune(t);
    this.pres.anims.prune(t, this.content.look.feedback.death.durationS);
    this.setup.audio.update(t);
    for (const s of this.pres.sound.take()) this.setup.audio.play(s);
    if (events.some((e) => e.t === "waveEnded")) {
      // A loop still alive at wave end would otherwise keep sounding on the result screen:
      // present() keeps running with t frozen at the end tick, and the result screen never
      // calls endWave() (Review I2).
      this.setup.audio.stopLoops();
      this.setup.onEnded(this.world.report);
    }
  }

  private draw(controls: ControlState | null): void {
    const { world, pres } = this;
    const { content } = this;
    const t = tickSeconds(world.tick);
    const player = playerOf(world);
    const cam = content.look.camera;
    updateLead(pres.camera, t, player.moveX, player.moveY, cam.lead, cam.leadSmoothS);
    followCamera(
      pres.camera,
      this.view,
      player.x + pres.camera.leadX,
      player.y + pres.camera.leadY,
      content.sim.rules.arena,
      cam.focusOffsetY,
    );
    const shake = shakeOffset(pres.camera, this.view, t, pres.shakeRng);
    this.actors.collect(content, pres.anims, world, t);
    // An unarmed stage player (content/stages) carries no skills: no aim, no cooldown.
    const cast = player.skills.find((s) => s.slot === "cast");
    if (cast === undefined && world.stage === null)
      throw new Error(`${player.def} has no skill in slot cast`);
    const aim = cast === undefined ? null : buildAim(player, cast, world.tick, controls);
    if (this.controls !== null && cast !== undefined) {
      const left = Math.max(0, cast.readyTick - world.tick);
      this.controls.button.setCooldown(left / cast.skill.intervalTicks, left / TICK_HZ);
    }
    this.telegraphCount = pres.telegraphs.draws(t, content.look, this.telegraphs);
    this.setup.scene.draw({
      view: this.view,
      camX: pres.camera.x + shake.x,
      camY: pres.camera.y + shake.y,
      t,
      actors: this.actors.draws,
      actorCount: this.actors.count,
      heads: this.heads,
      headCount: pres.tracker.heads(t, this.heads),
      pool: pres.em.pool,
      warnings: this.warnings,
      warningCount: pres.warnings.markers(t, content.look.feedback.spawnWarning, this.warnings),
      telegraphs: this.telegraphs,
      telegraphCount: this.telegraphCount,
      playerX: player.x,
      playerY: player.y,
      aim,
    });
  }
}
