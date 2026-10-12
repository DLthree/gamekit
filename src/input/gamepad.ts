import type { Vec } from "@/core/vec";

/** The W3C "standard" gamepad layout's buttons (Xbox names; a Deck's and a DualShock's agree). */
export const PAD = {
  a: 0,
  b: 1,
  x: 2,
  y: 3,
  lb: 4,
  rb: 5,
  lt: 6,
  rt: 7,
  select: 8,
  start: 9,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
} as const;

export type PadButton = keyof typeof PAD;

/**
 * Which names a pad's buttons wear on its hints: Xbox letters (an Xbox pad, a Steam Deck, a Steam
 * Controller, most others) or PlayStation shapes.
 */
export type GlyphSet = "xbox" | "playstation";

/** Sony's USB vendor id, which browsers put in a DualShock's or DualSense's id. */
const PLAYSTATION_ID = /playstation|dualshock|dualsense|054c/i;

/** The glyph set for a pad, from its Gamepad API id. */
export function glyphSet(id: string): GlyphSet {
  return PLAYSTATION_ID.test(id) ? "playstation" : "xbox";
}

/** The pad buttons a page hints at (src/ui/pad-keys.ts). */
export type HintButton = "a" | "b" | "x" | "y" | "lb" | "rb" | "start";

const GLYPHS: Record<GlyphSet, Record<HintButton, string>> = {
  xbox: { a: "A", b: "B", x: "X", y: "Y", lb: "LB", rb: "RB", start: "☰" },
  playstation: { a: "✕", b: "○", x: "□", y: "△", lb: "L1", rb: "R1", start: "☰" },
};

/** What `b` is called on a pad of `set`: the letter or shape printed on it. */
export function glyph(set: GlyphSet, b: HintButton): string {
  return GLYPHS[set][b];
}

/** A stick nearer centre than this (of full tilt) reads as centred: worn sticks drift. */
const STICK_DEAD_ZONE = 0.2;
/** A trigger pulled past this reads as pressed. */
const TRIGGER_DOWN = 0.5;

/**
 * A stick's raw axes past a radial dead zone, rescaled so tilt grows from 0 at its edge to 1 at
 * full tilt: no jump at the edge, and never longer than 1.
 */
export function deadZone(x: number, y: number, dead = STICK_DEAD_ZONE): Vec {
  const d = Math.hypot(x, y);
  if (d <= dead) return { x: 0, y: 0 };
  const k = Math.min(1, (d - dead) / (1 - dead)) / d;
  return { x: x * k, y: y * k };
}

/** The first connected pad, or null (no pad, or no Gamepad API at all). */
function firstPad(): Gamepad | null {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return null;
  for (const p of navigator.getGamepads()) if (p?.connected) return p;
  return null;
}

function isDown(p: Gamepad, i: number): boolean {
  const b = p.buttons[i];
  return b !== undefined && (b.pressed || b.value > TRIGGER_DOWN);
}

/**
 * One reader of the Gamepad API, polled once per frame (the API has no events for buttons): the
 * sticks past the dead zone, which buttons are down and which went down since the last poll.
 * Each consumer (the run's controls, the menus) keeps its own, so neither eats the other's presses.
 */
export class Pad {
  private down = new Set<number>();
  private was = new Set<number>();
  private left: Vec = { x: 0, y: 0 };
  private right: Vec = { x: 0, y: 0 };
  private id: string | null = null;

  /** Reads the pad now. With none connected every button is up and both sticks centred. */
  poll(): void {
    const p = firstPad();
    this.was = this.down;
    this.down = new Set();
    this.id = p?.id ?? null;
    if (p === null) {
      this.left = { x: 0, y: 0 };
      this.right = { x: 0, y: 0 };
      return;
    }
    for (let i = 0; i < p.buttons.length; i++) if (isDown(p, i)) this.down.add(i);
    this.left = deadZone(p.axes[0] ?? 0, p.axes[1] ?? 0);
    this.right = deadZone(p.axes[2] ?? 0, p.axes[3] ?? 0);
  }

  /** The glyph set of the pad at the last poll, or null with none connected. */
  glyphs(): GlyphSet | null {
    return this.id === null ? null : glyphSet(this.id);
  }

  /** `b` is down at the last poll. */
  held(b: PadButton): boolean {
    return this.down.has(PAD[b]);
  }

  /** `b` went down at the last poll. */
  pressed(b: PadButton): boolean {
    return this.down.has(PAD[b]) && !this.was.has(PAD[b]);
  }

  /** Any button went down, or a stick left centre, at the last poll: the pad is in use. */
  active(): boolean {
    for (const i of this.down) if (!this.was.has(i)) return true;
    return this.left.x !== 0 || this.left.y !== 0 || this.right.x !== 0 || this.right.y !== 0;
  }

  /** Move intent: the left stick, else the D-pad; never longer than 1, +y down. */
  move(): Vec {
    if (this.left.x !== 0 || this.left.y !== 0) return this.left;
    const x = (this.held("right") ? 1 : 0) - (this.held("left") ? 1 : 0);
    const y = (this.held("down") ? 1 : 0) - (this.held("up") ? 1 : 0);
    const d = Math.hypot(x, y);
    return d === 0 ? { x: 0, y: 0 } : { x: x / d, y: y / d };
  }

  /** The right stick's tilt past the dead zone, or null while it is centred. */
  aim(): Vec | null {
    return this.right.x === 0 && this.right.y === 0 ? null : this.right;
  }
}
