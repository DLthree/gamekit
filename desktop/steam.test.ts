import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  STEAM_NOT_RUNNING,
  type SteamPort,
  type SteamRecord,
  SteamSession,
  startSteam,
  steamLibrary,
} from "@desktop/steam";
import { describe, expect, it } from "vitest";

/** A Steam that answers as told and remembers what it was asked. */
class FakeSteam implements SteamPort {
  running = true;
  relaunch = false;
  initFailsOpen = false;
  /** Achievements the dashboard has; unlocking any other is refused. */
  known: Set<string> | null = null;
  readonly unlocked = new Set<string>();
  readonly calls: string[] = [];

  restartAppIfNecessary(appId: number): boolean {
    this.calls.push(`restart ${appId}`);
    return this.relaunch;
  }
  init(appId: number): boolean {
    this.calls.push(`init ${appId}`);
    return this.running || this.initFailsOpen;
  }
  initialized(): boolean {
    return this.running;
  }
  runCallbacks(): void {}
  async unlock(name: string): Promise<boolean> {
    this.calls.push(`unlock ${name}`);
    if (this.known !== null && !this.known.has(name)) return false;
    this.unlocked.add(name);
    return true;
  }
  async isUnlocked(name: string): Promise<boolean> {
    return this.unlocked.has(name);
  }
  shutdown(): void {}
}

/** An SDK folder with the mac library in it (or without, when `withLib` is false). */
function sdk(withLib = true): string {
  const dir = mkdtempSync(join(tmpdir(), "gamekit-steam-sdk-"));
  if (withLib) {
    const lib = steamLibrary(dir, "darwin");
    mkdirSync(dirname(lib), { recursive: true });
    writeFileSync(lib, "");
  }
  return dir;
}

const start = (port: SteamPort, sdkDir = sdk()) =>
  startSteam(port, { appId: 480, sdkDir, platform: "darwin" });

function session(port: FakeSteam): { s: SteamSession; log: SteamRecord[] } {
  const log: SteamRecord[] = [];
  return { s: new SteamSession(port, (r) => log.push(r)), log };
}

describe("Steam start-up", () => {
  it("runs when Steam is up: restart check, then init", () => {
    const port = new FakeSteam();
    expect(start(port)).toEqual({ kind: "running" });
    expect(port.calls).toEqual(["restart 480", "init 480"]);
  });

  it("is the error page when the SDK library is missing, before asking Steam anything", () => {
    const port = new FakeSteam();
    const dir = sdk(false);
    const r = start(port, dir);
    expect(r).toEqual({
      kind: "failed",
      problem: expect.stringContaining(join(dir, "redistributable_bin/osx/libsteam_api.dylib")),
    });
    expect(port.calls).toEqual([]);
  });

  it("is the error page when Steam isn't running", () => {
    const port = new FakeSteam();
    port.running = false;
    expect(start(port)).toEqual({ kind: "failed", problem: STEAM_NOT_RUNNING });
  });

  it("is the error page when init says yes but Steam reports itself not initialized", () => {
    const port = new FakeSteam();
    port.running = false;
    port.initFailsOpen = true;
    expect(start(port)).toEqual({ kind: "failed", problem: STEAM_NOT_RUNNING });
  });

  it("quits for Steam's relaunch without init", () => {
    const port = new FakeSteam();
    port.relaunch = true;
    expect(start(port)).toEqual({ kind: "relaunch" });
    expect(port.calls).toEqual(["restart 480"]);
  });

  it("names each OS's library, and refuses an OS the Steam build doesn't ship", () => {
    expect(steamLibrary("/sdk", "linux")).toBe("/sdk/redistributable_bin/linux64/libsteam_api.so");
    expect(steamLibrary("/sdk", "win32")).toBe("/sdk/redistributable_bin/win64/steam_api64.dll");
    expect(() => steamLibrary("/sdk", "freebsd")).toThrow("doesn't run on freebsd");
  });
});

describe("Steam achievements", () => {
  it("a deed earned unlocks its achievement", async () => {
    const port = new FakeSteam();
    const { s, log } = session(port);
    await s.unlockDeeds(["beast-tamer"]);
    expect([...port.unlocked]).toEqual(["DEED_BEAST_TAMER"]);
    expect(log).toEqual([{ kind: "steam", event: "unlocked", achievements: ["DEED_BEAST_TAMER"] }]);
  });

  it("the start-up re-sync unlocks only what Steam doesn't have yet", async () => {
    const port = new FakeSteam();
    port.unlocked.add("DEED_WYRMSLAYER");
    const { s } = session(port);
    await s.unlockDeeds(["wyrmslayer", "first-light", "beast-tamer"]);
    expect(port.calls).toEqual(["unlock DEED_FIRST_LIGHT", "unlock DEED_BEAST_TAMER"]);
    expect(port.unlocked.size).toBe(3);
  });

  it("an achievement Steam refuses goes in the log, and the rest still unlock", async () => {
    const port = new FakeSteam();
    port.known = new Set(["DEED_BEAST_TAMER"]);
    const { s, log } = session(port);
    await s.unlockDeeds(["first-light", "beast-tamer"]);
    expect(log).toEqual([
      { kind: "steam", event: "refused", achievement: "DEED_FIRST_LIGHT" },
      { kind: "steam", event: "unlocked", achievements: ["DEED_BEAST_TAMER"] },
    ]);
  });
});
