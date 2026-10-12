import { TICK_HZ } from "@/realtime/core/clock";
import { playerOf, type World } from "@/realtime/sim/world";

export interface HudModel {
  hp: number;
  maxHp: number;
  secondsLeft: number;
  kills: number;
  /** Whole seconds until the wave starts, or null once it has. */
  countdown: number | null;
}

export function hudModel(world: World): HudModel {
  const p = playerOf(world);
  return {
    hp: Math.max(0, Math.ceil(p.hp)),
    maxHp: p.maxHp,
    secondsLeft: Math.ceil((world.durationTicks - world.wave.elapsed) / TICK_HZ),
    kills: world.report.kills,
    countdown:
      world.phase === "countdown" ? Math.ceil((world.countdownTicks - world.tick) / TICK_HZ) : null,
  };
}

/** Life bar, time, kills, countdown. Touches the DOM only when the shown text changes. */
export class Hud {
  private readonly bar: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly stats: HTMLElement;
  private readonly countdown: HTMLElement;
  private last = "";

  constructor(root: HTMLElement) {
    this.bar = document.createElement("div");
    this.bar.className = "life";
    this.fill = document.createElement("div");
    this.bar.append(this.fill);
    this.stats = document.createElement("div");
    this.stats.className = "stats";
    this.countdown = document.createElement("div");
    this.countdown.className = "countdown";
    root.replaceChildren(this.bar, this.stats, this.countdown);
  }

  update(m: HudModel): void {
    const key = `${m.hp}|${m.maxHp}|${m.secondsLeft}|${m.kills}|${m.countdown}`;
    if (key === this.last) return;
    this.last = key;
    this.fill.style.width = `${(100 * m.hp) / m.maxHp}%`;
    this.stats.textContent = `${m.secondsLeft} s · ${m.kills} kills`;
    this.countdown.textContent = m.countdown === null ? "" : String(m.countdown);
  }
}
