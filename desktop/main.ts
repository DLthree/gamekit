/**
 * The desktop shell's main process (Electron). It serves the release build (dist/) from the
 * app:// protocol, keeps one instance, opens fullscreen (F11 or Alt+Enter toggle a window, and
 * the choice is kept), and answers the preload's save and telemetry calls with files in userData.
 * The Steam build (__STEAM__) also starts Steam first (desktop/steam-main.ts); the itch build's
 * bundle has no Steam code.
 */
import { join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { appendTelemetry, readSave, writeSave } from "@desktop/files";
import { IPC, type SaveReply } from "@desktop/ipc";
import type { SteamRecord } from "@desktop/steam";
import { type Bounds, loadMode, saveMode, type WindowMode } from "@desktop/window-mode";
import {
  app,
  BrowserWindow,
  dialog,
  type IpcMainEvent,
  ipcMain,
  Menu,
  net,
  protocol,
  screen,
} from "electron";

const SCHEME = "app";
const ORIGIN = `${SCHEME}://game`;
/** The game lays out for a phone up to a desktop; below this a window is too small to read. */
const MIN_SIZE = { width: 800, height: 500 };
const WINDOWED = { width: 1280, height: 800 };
/** Everything comes from app://game itself; art and sound may also be made in the page. */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
].join("; ");

// Tests (tests/desktop) point userData at a scratch folder. Before the instance lock: it's keyed
// on userData.
const userDataOverride = process.env.GAMEKIT_USER_DATA;
if (userDataOverride !== undefined) app.setPath("userData", resolve(userDataOverride));

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

/** The release build: dist/ beside desktop/ in the repo, and in the packaged app's asar. */
const distDir = join(app.getAppPath(), "dist");

/** A dist/ file for an app://game/ URL, or null for anything outside dist/. */
function distFile(url: string): string | null {
  const u = new URL(url);
  if (u.host !== "game") return null;
  const path = decodeURIComponent(u.pathname);
  const file = resolve(distDir, `.${path === "/" ? "/index.html" : path}`);
  return file.startsWith(distDir + sep) ? file : null;
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function reply<T>(event: IpcMainEvent, run: () => T): void {
  let r: SaveReply<T>;
  try {
    r = { ok: true, value: run() };
  } catch (err) {
    r = { ok: false, error: message(err) };
  }
  event.returnValue = r;
}

function stringArg(v: unknown, what: string): string {
  if (typeof v !== "string") throw new Error(`${what} must be a string, got ${typeof v}`);
  return v;
}

function answerSaves(): void {
  const saveDir = join(app.getPath("userData"), "save");
  const telemetryDir = join(app.getPath("userData"), "telemetry");
  ipcMain.on(IPC.saveGet, (e, key: unknown) =>
    reply(e, () => readSave(saveDir, stringArg(key, "save key"))),
  );
  ipcMain.on(IPC.saveSet, (e, key: unknown, value: unknown) =>
    reply(e, () => {
      writeSave(saveDir, stringArg(key, "save key"), stringArg(value, "save value"));
      return null;
    }),
  );
  // A failed append throws here, and Electron shows it in its main-process error dialog.
  ipcMain.on(IPC.telemetry, (_e, body: unknown) =>
    appendTelemetry(telemetryDir, stringArg(body, "telemetry body"), new Date()),
  );
}

/** Saved bounds still on some screen; otherwise a window of the default size, centred. */
function windowedBounds(saved: Bounds | null): Partial<Bounds> {
  if (saved === null) return WINDOWED;
  const visible = screen.getAllDisplays().some(({ workArea: a }) => {
    const w = Math.min(saved.x + saved.width, a.x + a.width) - Math.max(saved.x, a.x);
    const h = Math.min(saved.y + saved.height, a.y + a.height) - Math.max(saved.y, a.y);
    return w >= 100 && h >= 100;
  });
  return visible ? saved : { width: saved.width, height: saved.height };
}

function openWindow(userData: string, mode: WindowMode): BrowserWindow {
  const win = new BrowserWindow({
    ...windowedBounds(mode.bounds),
    minWidth: MIN_SIZE.width,
    minHeight: MIN_SIZE.height,
    // Only when true: an explicit `fullscreen: false` disables fullscreen for good on macOS.
    ...(mode.fullscreen ? { fullscreen: true } : {}),
    backgroundColor: "#000000",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // A pad press isn't a user gesture to Chromium: a pad-only player would never get the
      // audio unlocked without this.
      autoplayPolicy: "no-user-gesture-required",
    },
  });
  let current = mode;
  const keep = (next: WindowMode) => {
    current = next;
    saveMode(userData, current);
  };
  const windowed = () => !win.isFullScreen() && !win.isMaximized() && !win.isMinimized();
  win.on("enter-full-screen", () => keep({ ...current, fullscreen: true }));
  win.on("leave-full-screen", () => keep({ ...current, fullscreen: false }));
  // Bounds are noted as the window moves and written when it closes.
  const note = () => {
    if (windowed()) current = { ...current, bounds: win.getBounds() };
  };
  win.on("resized", note);
  win.on("moved", note);
  win.on("close", () => {
    note();
    saveMode(userData, current);
  });
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F11" || (input.key === "Enter" && input.alt)) {
      event.preventDefault();
      win.setFullScreen(!win.isFullScreen());
    }
  });
  win.once("ready-to-show", () => win.show());
  void win.loadURL(`${ORIGIN}/index.html`);
  return win;
}

/** Nothing leaves app://: no navigation elsewhere, no new windows. */
function lockNavigation(): void {
  app.on("web-contents-created", (_e, contents) => {
    const stay = (event: Electron.Event, url: string) => {
      if (!url.startsWith(`${ORIGIN}/`)) event.preventDefault();
    };
    contents.on("will-navigate", stay);
    contents.on("will-redirect", stay);
    contents.setWindowOpenHandler(() => ({ action: "deny" }));
  });
}

function fail(err: unknown): never {
  dialog.showErrorBox("The game can't start", message(err));
  app.exit(1);
  throw err;
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let win: BrowserWindow | null = null;
  app.on("second-instance", () => {
    if (win === null) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.on("window-all-closed", () => app.quit());
  lockNavigation();
  app
    .whenReady()
    .then(() => {
      // macOS keeps its app menu (Quit, Hide); elsewhere a game window has no menu bar.
      Menu.setApplicationMenu(
        process.platform === "darwin"
          ? Menu.buildFromTemplate([{ role: "appMenu" }, { role: "windowMenu" }])
          : null,
      );
      protocol.handle(SCHEME, async (request) => {
        const file = distFile(request.url);
        if (file === null) return new Response("not found", { status: 404 });
        const res = await net.fetch(pathToFileURL(file).toString());
        const headers = new Headers(res.headers);
        headers.set("content-security-policy", CSP);
        return new Response(res.body, { status: res.status, headers });
      });
      answerSaves();
      const userData = app.getPath("userData");
      // Required only here, so esbuild drops steam-main and steamworks-ffi-node from the itch build.
      if (__STEAM__) {
        const { bootSteam } =
          require("@desktop/steam-main") as typeof import("@desktop/steam-main");
        const telemetryDir = join(userData, "telemetry");
        const steam = bootSteam((r: SteamRecord) =>
          appendTelemetry(telemetryDir, JSON.stringify([r]), new Date()),
        );
        if (steam === "relaunch") {
          app.exit(0);
          return;
        }
      }
      win = openWindow(userData, loadMode(userData));
      win.on("closed", () => {
        win = null;
      });
    })
    .catch(fail);
}
