/**
 * The real SteamPort: steamworks-ffi-node over our own copy of the Steamworks SDK library.
 * Loaded only by the Steam build (desktop/steam-main.ts).
 */
import type { SteamPort } from "@desktop/steam";
import { SteamworksSDK } from "steamworks-ffi-node";

/** The binding's singleton, pointed at the SDK folder (its redistributable_bin/ layout). */
export function ffiSteamPort(sdkDir: string): SteamPort {
  const steam = SteamworksSDK.getInstance();
  steam.setSdkPath(sdkDir);
  return {
    restartAppIfNecessary: (appId) => steam.restartAppIfNecessary(appId),
    init: (appId) => steam.init({ appId }),
    initialized: () => steam.getStatus().initialized,
    runCallbacks: () => steam.runCallbacks(),
    unlock: (name) => steam.achievements.unlockAchievement(name),
    isUnlocked: (name) => steam.achievements.isAchievementUnlocked(name),
    shutdown: () => steam.shutdown(),
  };
}
