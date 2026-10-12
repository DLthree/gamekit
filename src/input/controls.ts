import { unit, type Vec } from "@/core/vec";
import type { AimMode } from "@/input/gesture";
import { Keyboard } from "@/input/keyboard";
import { Mouse } from "@/input/mouse";
import { SkillButton, type SkillTrace } from "@/input/skill-button";
import { TouchStick } from "@/input/stick";
import type { CastCommand } from "@/sim/command";

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

/** Stick, skill button, keys and mouse → one move intent, at most one cast, and the view state. */
export class Controls {
  readonly button: SkillButton;
  private readonly stick: TouchStick;
  private readonly keyboard = new Keyboard();
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
  }

  sample(): ControlSample {
    const move = this.stick.active ? this.stick.vector() : this.keyboard.move();
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
    }
    const b = this.button;
    const dir = b.aiming ? b.aim() : { x: 0, y: 0 };
    const u = unit(dir.x, dir.y, { x: 0, y: 0 });
    return {
      moveX: move.x,
      moveY: move.y,
      cast,
      view: {
        pressed: b.pressed,
        aiming: b.aiming,
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
