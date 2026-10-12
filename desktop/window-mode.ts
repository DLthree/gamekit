/**
 * The desktop window's mode, kept in `<userData>/desktop.json`: fullscreen (the default) or
 * windowed, and the windowed bounds to come back to. F11 or Alt+Enter toggles it.
 */
import { readSave, writeSave } from "@desktop/files";

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowMode {
  fullscreen: boolean;
  /** The last windowed bounds; null until the player has had a window. */
  bounds: Bounds | null;
}

const KEY = "desktop";
const DEFAULT_MODE: WindowMode = { fullscreen: true, bounds: null };

function isBounds(v: unknown): v is Bounds {
  if (typeof v !== "object" || v === null) return false;
  const b = v as Record<string, unknown>;
  return ["x", "y", "width", "height"].every((k) => Number.isInteger(b[k]));
}

/** The saved mode, or the default when there's none. Throws on a file it can't use. */
export function loadMode(userData: string): WindowMode {
  const text = readSave(userData, KEY);
  if (text === null) return DEFAULT_MODE;
  const v: unknown = JSON.parse(text);
  const m = v as Partial<Record<keyof WindowMode, unknown>>;
  if (
    typeof v !== "object" ||
    v === null ||
    typeof m.fullscreen !== "boolean" ||
    !(m.bounds === null || isBounds(m.bounds))
  )
    throw new Error(
      `${userData}/${KEY}.json: expected {fullscreen: boolean, bounds: null|{x,y,width,height}}`,
    );
  return { fullscreen: m.fullscreen, bounds: m.bounds };
}

export function saveMode(userData: string, mode: WindowMode): void {
  writeSave(userData, KEY, JSON.stringify(mode));
}
