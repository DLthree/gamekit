/**
 * The desktop preload (sandboxed, context-isolated): puts the DesktopBridge on
 * `window.gameDesktop` for the game (src/app/platform.ts).
 *
 * The game's save port is synchronous (localStorage's getItem/setItem), so each call is an
 * ipcRenderer.sendSync to the main process, which reads or atomically writes the file before it
 * answers. A save is on disk when setItem returns: nothing is buffered, so quitting (or a crash)
 * right after can't lose it. The cost is a short block of the page per save, so a game saves on
 * run steps and settings changes, never per frame.
 */

import { IPC, type SaveReply } from "@desktop/ipc";
import { contextBridge, ipcRenderer } from "electron";
import type { DesktopBridge } from "@/app/platform";

function unwrap<T>(reply: SaveReply<T> | undefined): T {
  if (reply === undefined) throw new Error("the desktop shell gave no answer for the save");
  if (!reply.ok) throw new Error(reply.error);
  return reply.value;
}

const bridge: DesktopBridge = {
  storage: {
    getItem: (key) => unwrap<string | null>(ipcRenderer.sendSync(IPC.saveGet, key)),
    setItem: (key, value) => {
      unwrap<null>(ipcRenderer.sendSync(IPC.saveSet, key, value));
    },
  },
  telemetry: (body) => ipcRenderer.send(IPC.telemetry, body),
  // __STEAM__ is a build constant: the itch build's preload has no Steam calls at all.
  steam: __STEAM__
    ? {
        problem: ipcRenderer.sendSync(IPC.steamProblem) as string | null,
        deeds: (ids) => ipcRenderer.send(IPC.steamDeeds, [...ids]),
      }
    : null,
};

contextBridge.exposeInMainWorld("gameDesktop", bridge);
