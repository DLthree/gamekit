/**
 * Keeps browser runs (e2e, shots) from exhausting the machine: each WebKit worker is a full
 * browser running the game, and parallel runs froze a 16 GB Mac twice (2026-09-26). One browser
 * run at a time, at most E2E_MAX_WORKERS e2e workers, and nothing starts when memory is already
 * short.
 *
 * WebKit runs also appear to leave near-zero memory held by kernel_task after they exit (106 GB
 * on 2026-09-27, filling the memory compressor until macOS killed its own daemons in a loop), so
 * a run also refuses when kernel_task is already large, and while the sysmon recorder is installed
 * (scripts/sysmon.sh, temporary for diagnosis) every run is marked in its log with the kernel
 * numbers before and after.
 */
import { execFileSync } from "node:child_process";
import { closeSync, existsSync, openSync, readFileSync, unlinkSync, writeSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const E2E_MAX_WORKERS = 3; // ~2.4 GB each; safe since the trace-screenshot leak fix
export const E2E_MAX_REPEAT = 3;
const MIN_FREE_PERCENT = 30;
const MAX_KERNEL_GB = 20;
const SYSMON = join(homedir(), ".local/bin/sysmon");
const LOCK = fileURLToPath(new URL("../.browser.lock", import.meta.url));

/** Throws on Playwright CLI flags that raise the worker count or repeat runs past the caps. */
export function checkE2eArgs(argv: readonly string[]): void {
  const value = (i: number, arg: string, flag: string): string | undefined =>
    arg.startsWith(`${flag}=`)
      ? arg.slice(flag.length + 1)
      : arg === flag
        ? argv[i + 1]
        : undefined;
  argv.forEach((arg, i) => {
    const workers = value(i, arg, "--workers") ?? value(i, arg, "-j");
    if (workers !== undefined && !(Number(workers) >= 1 && Number(workers) <= E2E_MAX_WORKERS))
      throw new Error(
        `--workers ${workers}: e2e runs at most ${E2E_MAX_WORKERS} workers (browser-guard.ts)`,
      );
    const repeat = value(i, arg, "--repeat-each");
    if (repeat !== undefined && !(Number(repeat) >= 1 && Number(repeat) <= E2E_MAX_REPEAT))
      throw new Error(`--repeat-each ${repeat}: at most ${E2E_MAX_REPEAT} (browser-guard.ts)`);
  });
}

/** Parses `memory_pressure -Q` output: "System-wide memory free percentage: 88%". */
export function parseFreePercent(output: string): number {
  const m = /free percentage:\s*(\d+)%/.exec(output);
  if (m === null) throw new Error(`memory_pressure: unexpected output: ${output.trim()}`);
  return Number(m[1]);
}

/** Parses top's MEM column ("106G", "3456M", "812K") into GB. */
export function parseTopMemGb(mem: string): number {
  const m = /^(\d+(?:\.\d+)?)([KMGT])\+?-?$/.exec(mem.trim());
  if (m === null) throw new Error(`top: unexpected MEM value: ${mem.trim()}`);
  const scale = { K: 1 / 1024 ** 2, M: 1 / 1024, G: 1, T: 1024 }[m[2] as "K" | "M" | "G" | "T"];
  return Number(m[1]) * scale;
}

function kernelGb(): number {
  const out = execFileSync("top", ["-l", "1", "-pid", "0", "-stats", "mem"], { encoding: "utf8" });
  return parseTopMemGb(out.trim().split("\n").at(-1) ?? "");
}

/** Appends a marker to the sysmon log while the recorder is installed; it expires by itself. */
export function sysmonMark(text: string): void {
  if (existsSync(SYSMON)) execFileSync(SYSMON, ["mark", text]);
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Takes the repo's single browser-run lock, or throws naming the holder. Also refuses when free
 * memory is under MIN_FREE_PERCENT. Returns the release function; it also runs on process exit.
 */
export function acquireBrowserLock(what: string): () => void {
  const free = parseFreePercent(execFileSync("memory_pressure", ["-Q"], { encoding: "utf8" }));
  if (free < MIN_FREE_PERCENT)
    throw new Error(
      `${what}: only ${free}% memory free (need ${MIN_FREE_PERCENT}%); not starting a browser`,
    );
  const kernel = kernelGb();
  if (kernel > MAX_KERNEL_GB)
    throw new Error(
      `${what}: kernel_task holds ${kernel.toFixed(0)} GB (limit ${MAX_KERNEL_GB}); restart the Mac before browser runs`,
    );
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(LOCK, "wx");
      writeSync(fd, `${process.pid} ${what}\n`);
      closeSync(fd);
      sysmonMark(`start ${what}`);
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        unlinkSync(LOCK);
        sysmonMark(`end ${what}`);
      };
      process.on("exit", release);
      return release;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      const [pid, ...rest] = readFileSync(LOCK, "utf8").trim().split(" ");
      if (alive(Number(pid)))
        throw new Error(
          `${what}: another browser run holds .browser.lock (pid ${pid}: ${rest.join(" ")}); wait for it`,
        );
      unlinkSync(LOCK); // stale: its owner died without releasing
    }
  }
  throw new Error(`${what}: could not take .browser.lock`);
}
