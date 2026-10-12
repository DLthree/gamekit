import { unit, type Vec } from "@/core/vec";
import { Pad } from "@/input/gamepad";
import type { AimMode } from "@/realtime/input/gesture";
import { Keyboard } from "@/realtime/input/keyboard";
import { Mouse } from "@/realtime/input/mouse";
import { SkillButton, type SkillTrace } from "@/realtime/input/skill-button";
import { TouchStick } from "@/realtime/input/stick";
import type { CastCommand } from "@/realtime/sim/command";

/** View-only control state: the aim indicator and button looks. The sim never reads it. */
export interface ControlState {
  pressed: boolean;
  aiming: boolean;
  cancelArmed: boolean;
  /** Unit aim direction in screen (= world) axes while aiming. */
  aimX: number;
  aimY: number;
}

export interface ControlElements {
  touchZone: HTMLElement;
  stickBase: HTMLElement;
  stickKnob: HTMLElement;
  skillButton: HTMLElement;
  skillKnob: HTMLElement;
}

export interface ControlsOptions {
  elements: ControlElements;
  mode: AimMode;
  stickRadius: number;
  stickDeadZone: number;
  buttonRadius: number;
  knobRadius: number;
  /** CSS colour of the skill button's ring while a release would cancel. */
  cancelColor: string;
  playerCss: () => Vec;
  onTrace: (t: SkillTrace) => void;
}

export interface ControlSample {
  moveX: number;
  moveY: number;
  cast: CastCommand | null;
  view: ControlState;
}

/**
 * Touch stick and skill button, keys, mouse and gamepad → one move intent, at most one cast, and
 * the view state. Every device maps to the same commands: move (stick, WASD/arrows, pad left
 * stick or D-pad) and cast (skill button, Space, left click, pad A or RT, aimed by the right
 * stick or at the nearest foe with it centred).
 */
export class Controls {
  readonly button: SkillButton;
  private readonly stick: TouchStick;
  private readonly keyboard = new Keyboard();
  private readonly pad = new Pad();
  private readonly mouse: Mouse;
  private readonly playerCss: () => Vec;

  constructor(o: ControlsOptions) {
    const el = o.elements;
    for (const [e, r] of [
      [el.skillButton, o.buttonRadius],
      [el.skillKnob, o.knobRadius],
      [el.stickKnob, o.knobRadius],
    ] as const) {
      e.style.width = `${2 * r}px`;
      e.style.height = `${2 * r}px`;
    }
    el.skillButton.style.setProperty("--cancel-color", o.cancelColor);
    this.playerCss = o.playerCss;
    this.stick = new TouchStick(
      el.touchZone,
      el.stickBase,
      el.stickKnob,
      o.stickRadius,
      o.stickDeadZone,
    );
    this.button = new SkillButton(el.skillButton, el.skillKnob, {
      mode: o.mode,
      playerCss: o.playerCss,
      onTrace: o.onTrace,
    });
    this.mouse = new Mouse(el.touchZone);
    // A pad button still held from the menu press that started the wave is not a new press.
    this.pad.poll();
  }

  sample(): ControlSample {
    this.pad.poll();
    const keys = this.keyboard.move();
    const move = this.stick.active
      ? this.stick.vector()
      : keys.x !== 0 || keys.y !== 0
        ? keys
        : this.pad.move();
    const padAim = this.pad.aim();
    const padCast = this.pad.pressed("a") || this.pad.pressed("rt");
    let cast: CastCommand | null = null;
    const r = this.button.takeRelease();
    const clicked = this.mouse.takeClick();
    const spaced = this.keyboard.takeCast();
    if (r !== null) {
      if (r.kind === "quick") cast = { slot: "cast", aim: "auto" };
      else if (r.kind === "cast") cast = { slot: "cast", aim: { x: r.aimX, y: r.aimY } };
    } else if ((clicked || spaced) && !this.button.pressed) {
      const m = this.mouse.position;
      const p = this.playerCss();
      cast = { slot: "cast", aim: m === null ? "auto" : { x: m.x - p.x, y: m.y - p.y } };
    } else if (padCast && !this.button.pressed) {
      cast = { slot: "cast", aim: padAim === null ? "auto" : { x: padAim.x, y: padAim.y } };
    }
    const b = this.button;
    // The right stick shows its aim as the skill button's drag does.
    const padAiming = !b.aiming && padAim !== null;
    const dir = b.aiming ? b.aim() : (padAim ?? { x: 0, y: 0 });
    const u = unit(dir.x, dir.y, { x: 0, y: 0 });
    return {
      moveX: move.x,
      moveY: move.y,
      cast,
      view: {
        pressed: b.pressed,
        aiming: b.aiming || padAiming,
        cancelArmed: b.cancelArmed,
        aimX: u.x,
        aimY: u.y,
      },
    };
  }

  release(): void {
    this.stick.release();
    this.button.release();
    this.keyboard.release();
    this.mouse.release();
  }
}
