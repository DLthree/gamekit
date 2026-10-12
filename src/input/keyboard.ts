import { unit, type Vec } from "@/core/vec";

const UP = ["KeyW", "ArrowUp"];
const DOWN = ["KeyS", "ArrowDown"];
const LEFT = ["KeyA", "ArrowLeft"];
const RIGHT = ["KeyD", "ArrowRight"];
const GAME_KEYS = new Set([...UP, ...DOWN, ...LEFT, ...RIGHT, "Space"]);

function any(down: ReadonlySet<string>, keys: readonly string[]): boolean {
  return keys.some((k) => down.has(k));
}

/** Held keys → a move vector of length 0 or 1 (diagonals are not faster). */
export function keysToMove(down: ReadonlySet<string>): Vec {
  const x = (any(down, RIGHT) ? 1 : 0) - (any(down, LEFT) ? 1 : 0);
  const y = (any(down, DOWN) ? 1 : 0) - (any(down, UP) ? 1 : 0);
  return unit(x, y, { x: 0, y: 0 });
}

/** WASD / arrows to move, Space to cast. */
export class Keyboard {
  private readonly down = new Set<string>();
  private castPressed = false;
  private readonly onDown = (e: KeyboardEvent) => {
    if (!GAME_KEYS.has(e.code)) return;
    e.preventDefault();
    if (e.code === "Space" && !e.repeat) this.castPressed = true;
    this.down.add(e.code);
  };
  private readonly onUp = (e: KeyboardEvent) => {
    this.down.delete(e.code);
  };
  private readonly onBlur = () => {
    this.down.clear();
  };

  constructor() {
    window.addEventListener("keydown", this.onDown);
    window.addEventListener("keyup", this.onUp);
    window.addEventListener("blur", this.onBlur);
  }

  move(): Vec {
    return keysToMove(this.down);
  }

  takeCast(): boolean {
    const c = this.castPressed;
    this.castPressed = false;
    return c;
  }

  release(): void {
    window.removeEventListener("keydown", this.onDown);
    window.removeEventListener("keyup", this.onUp);
    window.removeEventListener("blur", this.onBlur);
  }
}
