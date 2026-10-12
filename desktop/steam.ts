/**
 * Steam in the desktop shell (Steam build only): the start-up order with its fail-fast checks,
 * and the session the game's deeds go through. Everything here talks to Steam through a
 * SteamPort: steamworks-ffi-node in the app (desktop/steam-ffi.ts), a fake in tests.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { achievementName } from "@/content/achievements";

/** What the shell needs from Steam. */
export interface SteamPort {
  /** True when Steam must relaunch the game through itself (then the game quits). */
  restartAppIfNecessary(appId: number): boolean;
  /** SteamAPI_Init: false when Steam isn't running or the user doesn't own the app. */
  init(appId: number): boolean;
  /** Whether the API reports itself initialized (the binding's init can fail open). */
  initialized(): boolean;
  runCallbacks(): void;
  unlock(apiName: string): Promise<boolean>;
  isUnlocked(apiName: string): Promise<boolean>;
  shutdown(): void;
}

/**
 * The Steamworks SDK's redistributable library for each OS we ship, under the SDK folder (the
 * layout the binding's setSdkPath expects: vendor/steamworks_sdk/ in the repo, the app's
 * Resources/steamworks_sdk/ packaged).
 */
export const STEAM_LIBRARIES = {
  darwin: "redistributable_bin/osx/libsteam_api.dylib",
  linux: "redistributable_bin/linux64/libsteam_api.so",
  win32: "redistributable_bin/win64/steam_api64.dll",
} as const;

export function steamLibrary(sdkDir: string, platform: NodeJS.Platform): string {
  if (!Object.hasOwn(STEAM_LIBRARIES, platform))
    throw new Error(`the Steam build doesn't run on ${platform}`);
  return join(sdkDir, STEAM_LIBRARIES[platform as keyof typeof STEAM_LIBRARIES]);
}

export const STEAM_NOT_RUNNING =
  "Steam isn't running, or isn't logged in. Start Steam, then open the game from your Steam library.";

export type SteamStart =
  | { kind: "running" }
  /** Steam is relaunching the game through itself: quit now. */
  | { kind: "relaunch" }
  /** The game can't run as a Steam game: the error panel says why. */
  | { kind: "failed"; problem: string };

/**
 * Steam's start-up: the SDK library must exist before restartAppIfNecessary (which says false,
 * not an error, when it's missing); then init, and the API's own status after it (init can
 * report success it didn't have).
 */
export function startSteam(
  port: SteamPort,
  o: { appId: number; sdkDir: string; platform: NodeJS.Platform },
): SteamStart {
  const lib = steamLibrary(o.sdkDir, o.platform);
  if (!existsSync(lib))
    return {
      kind: "failed",
      problem: `The Steam library is missing (${lib}). Reinstall the game from your Steam library.`,
    };
  if (port.restartAppIfNecessary(o.appId)) return { kind: "relaunch" };
  if (!port.init(o.appId) || !port.initialized())
    return { kind: "failed", problem: STEAM_NOT_RUNNING };
  return { kind: "running" };
}

/** What the session writes to the play log (telemetry jsonl, `kind: "steam"`). */
export type SteamRecord =
  | { kind: "steam"; event: "unlocked"; achievements: string[] }
  | { kind: "steam"; event: "refused"; achievement: string };

/** The running Steam session: the deeds' achievements. */
export class SteamSession {
  private readonly port: SteamPort;
  private readonly log: (record: SteamRecord) => void;

  constructor(port: SteamPort, log: (record: SteamRecord) => void) {
    this.port = port;
    this.log = log;
  }

  /**
   * Unlocks the deeds' achievements Steam doesn't have yet: deeds as they're earned, and every
   * earned deed at start-up (the re-sync). An unlock Steam refuses (an achievement missing from
   * the dashboard) goes in the log, and the game plays on.
   */
  async unlockDeeds(deedIds: readonly string[]): Promise<void> {
    const unlocked: string[] = [];
    for (const id of deedIds) {
      const name = achievementName(id);
      if (await this.port.isUnlocked(name)) continue;
      if (await this.port.unlock(name)) unlocked.push(name);
      else this.log({ kind: "steam", event: "refused", achievement: name });
    }
    if (unlocked.length > 0) this.log({ kind: "steam", event: "unlocked", achievements: unlocked });
  }

  runCallbacks(): void {
    this.port.runCallbacks();
  }

  shutdown(): void {
    this.port.shutdown();
  }
}
