import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron, type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { compileShell } from "@scripts/desktop-build";

// The desktop app (desktop/, unpacked: `electron .` on dist/, the release build) keeps its saves
// in <userData>/save/ across a quit: a deed earned shows as earned after a relaunch.

const ROOT = resolve(".");

/** Electron on `appDir`, with userData in `dir`, windowed (fullscreen makes macOS switch Spaces). */
async function launch(
  dir: string,
  appDir = ".",
): Promise<{ app: ElectronApplication; page: Page; errors: string[] }> {
  writeFileSync(join(dir, "desktop.json"), JSON.stringify({ fullscreen: false, bounds: null }));
  const app = await _electron.launch({
    args: [appDir],
    env: { ...process.env, GAMEKIT_USER_DATA: dir },
  });
  const page = await app.firstWindow();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return { app, page, errors };
}

test("a deed earned in the desktop app is still earned after a quit and relaunch", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gamekit-desktop-"));
  const first = await launch(dir);
  try {
    expect(await first.page.evaluate(() => typeof window.gameDesktop)).toBe("object");
    // The release build: no agent handle, and the deeds list on the grid.
    expect(await first.page.evaluate(() => typeof window.__game)).toBe("undefined");
    await expect(first.page.locator("#picker .deeds li")).toHaveCount(3);
    await expect(first.page.locator("#picker .deeds li.earned")).toHaveCount(0);
    // The save port, through the preload's IPC: written atomically, read back on a reload.
    await first.page.evaluate(() =>
      window.gameDesktop?.storage.setItem("deeds", '{"version":1,"earned":["lion-tamer"]}'),
    );
    await first.page.reload();
    await expect(first.page.locator('#picker .deeds li[data-deed="lion-tamer"]')).toHaveClass(
      /earned/,
    );
    // The telemetry flush runs every 5 s.
    await first.page.waitForTimeout(6000);
    expect(first.errors).toEqual([]);
  } finally {
    await first.app.close();
  }
  expect(JSON.parse(readFileSync(join(dir, "save", "deeds.json"), "utf8")).earned).toEqual([
    "lion-tamer",
  ]);

  const second = await launch(dir);
  try {
    await expect(second.page.locator("#picker .deeds li.earned")).toHaveCount(1);
    expect(second.errors).toEqual([]);
  } finally {
    await second.app.close();
  }
  // Telemetry went to the day's jsonl beside the saves.
  const day = new Date().toISOString().slice(0, 10);
  expect(readFileSync(join(dir, "telemetry", `${day}.jsonl`), "utf8")).toContain('"kind":"load"');
});

test("a corrupt save file is the Save panel, naming the file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gamekit-desktop-"));
  mkdirSync(join(dir, "save"));
  writeFileSync(join(dir, "save", "deeds.json"), '{"version": 1, "ea');
  const { app, page } = await launch(dir);
  try {
    await expect(page.locator("#error h1")).toHaveText("Save");
    await expect(page.locator("#error")).toContainText("deeds.json is not JSON");
  } finally {
    await app.close();
  }
});

// The Steam build never runs with Steam silently off: without the SDK library beside it, the game
// opens on the Steam panel and goes no further. The app here is a copy of the repo's shape
// (package.json, dist/, node_modules/) with the Steam shell (on Spacewar's test App ID) and no
// vendor/.
test("the Steam build without the Steam library is the Steam panel", async () => {
  const appDir = mkdtempSync(join(tmpdir(), "gamekit-steam-app-"));
  writeFileSync(join(appDir, "package.json"), readFileSync(join(ROOT, "package.json")));
  symlinkSync(join(ROOT, "dist"), join(appDir, "dist"));
  symlinkSync(join(ROOT, "node_modules"), join(appDir, "node_modules"));
  await compileShell("steam", join(appDir, "desktop", "dist"), 480);
  const { app, page } = await launch(mkdtempSync(join(tmpdir(), "gamekit-desktop-")), appDir);
  try {
    await expect(page.locator("#error h1")).toHaveText("Steam");
    await expect(page.locator("#error")).toContainText("The Steam library is missing");
    await expect(page.locator("#error button")).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test("the itch build's shell holds no Steam code", () => {
  for (const f of ["main.cjs", "preload.cjs"])
    expect(readFileSync(join(ROOT, "desktop/dist", f), "utf8")).not.toMatch(/steamworks/i);
});
