/**
 * The Steam build's main-process side: starts Steam (desktop/steam.ts) on our SDK copy, answers
 * the preload's Steam calls, runs Steam's callbacks and shuts Steam down on quit.
 * desktop/main.ts requires this module only when __STEAM__, so the itch build has none of it.
 */
import { join } from "node:path";
import { IPC } from "@desktop/ipc";
import { type SteamRecord, SteamSession, startSteam } from "@desktop/steam";
import { ffiSteamPort } from "@desktop/steam-ffi";
import { app, dialog, ipcMain } from "electron";

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isIds(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((id) => typeof id === "string");
}

/**
 * Starts Steam and answers the preload. "relaunch" means Steam is starting the game through
 * itself: quit at once. When Steam can't start, the preload's problem says why and the game shows
 * it on its error panel; nothing runs with Steam silently off.
 */
export function bootSteam(log: (record: SteamRecord) => void): "running" | "failed" | "relaunch" {
  // In the repo (not packaged) Steam takes the App ID from the environment, so it doesn't relaunch
  // the game through itself; the packaged app has no such override.
  if (!app.isPackaged) process.env.SteamAppId = String(__STEAM_APP_ID__);
  const sdkDir = app.isPackaged
    ? join(process.resourcesPath, "steamworks_sdk")
    : join(app.getAppPath(), "vendor", "steamworks_sdk");
  let session: SteamSession | null = null;
  let problem: string | null = null;
  try {
    const port = ffiSteamPort(sdkDir);
    const start = startSteam(port, { appId: __STEAM_APP_ID__, sdkDir, platform: process.platform });
    if (start.kind === "relaunch") return "relaunch";
    if (start.kind === "failed") problem = start.problem;
    else session = new SteamSession(port, log);
  } catch (err) {
    problem = `Steam couldn't start: ${message(err)}`;
  }
  ipcMain.on(IPC.steamProblem, (e) => {
    e.returnValue = problem;
  });
  const running = session;
  if (running === null) return "failed";
  const fail = (err: unknown) => dialog.showErrorBox("Steam", message(err));
  ipcMain.on(IPC.steamDeeds, (_e, ids: unknown) => {
    if (!isIds(ids)) return fail(new Error("steam deeds must be a list of deed ids"));
    running.unlockDeeds(ids).catch(fail);
  });
  const callbacks = setInterval(() => running.runCallbacks(), 100);
  app.on("before-quit", () => {
    clearInterval(callbacks);
    running.shutdown();
  });
  return "running";
}
