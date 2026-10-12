import { type HintButton, Pad } from "@/input/gamepad";

export type Direction = "up" | "down" | "left" | "right";

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Off the line of travel counts this many times as far as along it: a straight neighbour wins. */
const SIDEWAYS_WEIGHT = 2;

/**
 * The box nearest `from` in `dir` (index into `boxes`), or null with none that way. A box is that
 * way when its centre lies past `from`'s centre along `dir`; the nearest weighs how far off the
 * line of travel it sits.
 */
export function nearest(from: Box, boxes: readonly Box[], dir: Direction): number | null {
  const fx = from.left + from.width / 2;
  const fy = from.top + from.height / 2;
  let best: number | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  boxes.forEach((b, i) => {
    const dx = b.left + b.width / 2 - fx;
    const dy = b.top + b.height / 2 - fy;
    const along = dir === "left" ? -dx : dir === "right" ? dx : dir === "up" ? -dy : dy;
    const off = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
    if (along <= 1) return;
    const score = along + SIDEWAYS_WEIGHT * off;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

const FOCUSABLE = "button, a[href], input, select, summary, [tabindex]:not([tabindex='-1'])";

/** A held direction repeats after this long, then this often. */
const REPEAT_DELAY_MS = 400;
const REPEAT_EVERY_MS = 140;
/** The left stick tilted past this (on its longer axis) is a direction in the menus. */
const STICK_DIRECTION = 0.5;

function shown(e: Element): boolean {
  return (
    e instanceof HTMLElement &&
    e.getClientRects().length > 0 &&
    getComputedStyle(e).visibility !== "hidden"
  );
}

export interface PadNavOptions {
  /** Screen root ids that take the pad alone while shown, as a dialog would (an error panel). */
  modals: readonly string[];
  /** The run's controls have the pad (a wave, not paused): the menus leave it alone. */
  inFight(): boolean;
  /** Start (or Escape): pauses a fight, resumes a paused one. */
  start(): void;
  /** B (or Backspace) on a screen with no way-back shortcut. */
  back(): void;
}

/**
 * The gamepad over the DOM screens, polled each animation frame. It reaches every shown menu page
 * (`showPage`, src/ui/page.ts, marks its root `data-page`), or an open modal alone. The D-pad or
 * left stick moves focus to the nearest button that way, A presses the focused one, else the
 * screen's A shortcut
 * (its primary action). B, X, Y and Start press the screen's shortcut buttons (`data-pad`, set by
 * src/ui/pad-keys.ts); B is the way back (as Backspace is), Start pauses or resumes a fight (as
 * Escape does). It marks which device was used last on the body (`data-input="pad"` or
 * `"keys"`), which draws the pad's focus ring and hints, and which glyphs the pad wears
 * (`data-glyphs`).
 */
export function startPadNav(o: PadNavOptions): void {
  const pad = new Pad();
  const setInput = (v: "pad" | "keys"): void => {
    if (document.body.dataset.input !== v) document.body.dataset.input = v;
  };
  for (const ev of ["keydown", "pointerdown"] as const)
    window.addEventListener(ev, () => setInput("keys"), { capture: true });
  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "mouse") setInput("keys");
    },
    { capture: true },
  );

  /** The screens the pad can reach now: an open modal alone, else every shown page. */
  const liveRoots = (): HTMLElement[] => {
    for (const id of o.modals) {
      const e = document.getElementById(id);
      if (e !== null && !e.hidden && shown(e)) return [e];
    }
    return [...document.querySelectorAll<HTMLElement>("[data-page]")].filter(
      (e) => !e.hidden && shown(e),
    );
  };
  const targets = (): HTMLElement[] => {
    const out: HTMLElement[] = [];
    for (const r of liveRoots())
      for (const e of r.querySelectorAll<HTMLElement>(FOCUSABLE))
        if ((e as HTMLButtonElement).disabled !== true && shown(e)) out.push(e);
    return out;
  };

  const stickDirection = (m: { x: number; y: number }): Direction | null => {
    if (Math.max(Math.abs(m.x), Math.abs(m.y)) < STICK_DIRECTION) return null;
    if (Math.abs(m.x) > Math.abs(m.y)) return m.x > 0 ? "right" : "left";
    return m.y > 0 ? "down" : "up";
  };
  const direction = (): Direction | null => {
    for (const d of ["up", "down", "left", "right"] as const) if (pad.held(d)) return d;
    return stickDirection(pad.move());
  };

  /** Focus to the nearest target `dir` of the focused one (or the first, with none focused). */
  const move = (dir: Direction): void => {
    const all = targets();
    if (all.length === 0) return;
    const at = document.activeElement;
    if (!(at instanceof HTMLElement) || !all.includes(at)) {
      all[0].focus();
      return;
    }
    const others = all.filter((e) => e !== at);
    const n = nearest(
      at.getBoundingClientRect(),
      others.map((e) => e.getBoundingClientRect()),
      dir,
    );
    if (n !== null) others[n].focus();
  };

  /** Presses the live screens' shortcut button for `b`; false with none. */
  const shortcut = (b: HintButton): boolean => {
    const hit = targets().find((e) => e.dataset.pad === b);
    hit?.click();
    return hit !== undefined;
  };

  const confirm = (): void => {
    const acts = targets();
    const at = document.activeElement;
    if (at instanceof HTMLElement && acts.includes(at)) at.click();
    else if (!shortcut("a") && acts.length > 0) acts[0].focus();
  };
  const back = (): void => {
    if (!shortcut("b")) o.back();
  };
  const start = (): void => {
    if (o.inFight() || !shortcut("start")) o.start();
  };

  window.addEventListener("keydown", (e) => {
    if (e.repeat || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape") {
      e.preventDefault();
      start();
    } else if (e.key === "Backspace" && !o.inFight()) {
      e.preventDefault();
      back();
    }
  });

  let held: Direction | null = null;
  let nextAt = 0;
  const steer = (dir: Direction | null, nowMs: number): void => {
    if (dir !== held) {
      held = dir;
      nextAt = nowMs + REPEAT_DELAY_MS;
      if (dir !== null) move(dir);
    } else if (dir !== null && nowMs >= nextAt) {
      nextAt = nowMs + REPEAT_EVERY_MS;
      move(dir);
    }
  };

  const tick = (nowMs: number): void => {
    requestAnimationFrame(tick);
    pad.poll();
    if (pad.active()) setInput("pad");
    const glyphs = pad.glyphs();
    if (glyphs !== null && document.body.dataset.glyphs !== glyphs)
      document.body.dataset.glyphs = glyphs;
    if (pad.pressed("start")) start();
    if (o.inFight()) {
      held = null;
      return;
    }
    steer(direction(), nowMs);
    if (pad.pressed("a")) confirm();
    else if (pad.pressed("b")) back();
    else if (pad.pressed("x")) shortcut("x");
    else if (pad.pressed("y")) shortcut("y");
  };
  requestAnimationFrame(tick);
}
