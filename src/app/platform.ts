/**
 * Where the game runs: in the desktop shell (desktop/, Electron) its preload puts a bridge on
 * `window.gameDesktop`; on the web (pnpm dev, the phone build, a plain browser) there is none.
 * The saves take one getItem/setItem port either way: files on disk or localStorage. The Steam
 * build's shell adds Steam (achievements for deeds); the itch build and the web have none, and
 * the steam calls here do nothing there.
 */

/** A save port: localStorage's two calls. Any call may throw; the caller shows the error panel. */
export type SaveStore = Pick<Storage, "getItem" | "setItem">;

/** What desktop/preload.ts exposes. */
export interface DesktopBridge {
  /**
   * The saves as `<userData>/save/<key>.json`. Each call blocks until the main process has read
   * the file or written it atomically, and throws the main process's error.
   */
  storage: SaveStore;
  /** Appends one telemetry flush (a JSON array) to `<userData>/telemetry/<date>.jsonl`. */
  telemetry: (body: string) => void;
  /** Steam in the Steam build; null in the itch (DRM-free) build. */
  steam: SteamBridge | null;
}

/** What the Steam build's preload adds (desktop/steam-main.ts answers it). */
export interface SteamBridge {
  /** Why Steam couldn't start (the game shows it and plays no further), or null when it runs. */
  problem: string | null;
  /** Deeds earned (or already earned, at start-up): their achievements unlock. */
  deeds: (ids: readonly string[]) => void;
}

declare global {
  interface Window {
    gameDesktop?: DesktopBridge;
  }
}

/** The desktop shell's bridge, or null on the web. */
export function desktopBridge(): DesktopBridge | null {
  return window.gameDesktop ?? null;
}

/** localStorage, touched only inside each call: even reading `localStorage` can throw. */
const browserStore: SaveStore = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
};

/** The saves' port: the desktop's files, or the browser's localStorage. */
export function saveStore(): SaveStore {
  return desktopBridge()?.storage ?? browserStore;
}

/** Why the Steam build can't run (Steam not running, its library missing), or null. */
export function steamProblem(): string | null {
  return desktopBridge()?.steam?.problem ?? null;
}

/** Unlocks the deeds' Steam achievements (the Steam build only). */
export function steamDeeds(ids: readonly string[]): void {
  if (ids.length > 0) desktopBridge()?.steam?.deeds(ids);
}
