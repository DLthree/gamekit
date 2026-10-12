import Phaser from "phaser";
import type { SoundPlay } from "@/present/sound";
import { AudioUnlock } from "@/render/audio-unlock";
import { LoopTracker } from "@/render/loop-tracker";

/** Plays the sound plan's picks through Phaser's WebAudio; sounds are loaded by WorldScene. */
export class AudioOut {
  readonly unlock: AudioUnlock;
  private readonly manager: Phaser.Sound.WebAudioSoundManager;
  private readonly loops = new LoopTracker();

  constructor(scene: Phaser.Scene) {
    const m = scene.sound;
    if (!(m instanceof Phaser.Sound.WebAudioSoundManager)) {
      throw new Error("audio: this browser has no Web Audio (Phaser chose another sound manager)");
    }
    this.manager = m;
    this.unlock = new AudioUnlock(m.context, document.body);
    // Phaser resumes the context on its own, with no catch: every frame while the game has focus
    // (update → onFocus) and 100 ms after the page turns visible (onGameVisible, its iOS 17/18
    // suspend-then-resume fix). A rejected resume there is an unhandled rejection, which crashes
    // the wave, so both go through AudioUnlock's counted resume instead.
    // Both hooks are protected/private in Phaser's types, hence the cast.
    const hooks = m as unknown as { onFocus: () => void; onGameVisible: () => void };
    hooks.onFocus = () => {
      if (!m.locked) this.unlock.resume();
    };
    const game = scene.game.events;
    game.off(Phaser.Core.Events.VISIBLE, hooks.onGameVisible, m);
    game.on(Phaser.Core.Events.VISIBLE, () => {
      window.setTimeout(() => {
        m.context
          .suspend()
          .catch((err: unknown) => console.warn("audio: suspend failed", err))
          .finally(() => this.unlock.resume());
      }, 100);
    });
  }

  /** Sounds can start now: the context runs and Phaser has seen it unlock. */
  get running(): boolean {
    return this.unlock.running && !this.manager.locked;
  }

  get state(): string {
    return this.manager.context.state;
  }

  /**
   * A one-shot plays and destroys itself when it ends (Phaser's `manager.play`). A play with
   * `untilT` loops instead: `manager.add` + `.play()` so we keep the handle, and the
   * wave's presentation time stops it later via `update`.
   */
  play(p: SoundPlay): void {
    if (p.untilT === undefined) {
      this.manager.play(p.id, { rate: p.rate, volume: p.volume });
      return;
    }
    const sound = this.manager.add(p.id, { rate: p.rate, volume: p.volume, loop: true });
    sound.play();
    this.loops.add(sound, p.untilT);
  }

  /** Stops any loop whose end time has passed; the wave calls this every tick with presentation time. */
  update(t: number): void {
    this.loops.update(t);
  }

  /** Wave teardown: stops any loop still sounding (e.g. a zone alive when the wave ends). */
  stopLoops(): void {
    this.loops.stopAll();
  }

  /**
   * Test-only hook (manual=1, see GameHandle.suspendAudio): forces the context to "suspended" so
   * an e2e can check the game resumes it, and survives a refused resume.
   */
  suspend(): Promise<void> {
    return this.manager.context.suspend();
  }
}
