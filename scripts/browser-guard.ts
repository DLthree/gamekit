/**
 * Keeps browser runs (e2e, shots) from exhausting the machine: each WebKit worker is a full
 * browser running the game, and parallel runs froze a 16 GB Mac twice (2026-09-26). One browser
 * run at a time, at most E2E_MAX_WORKERS e2e workers, and nothing starts when memory is already
 * short.
 *
 * WebKit runs also appear to leave near-zero memory held by kernel_task after they exit (106 GB
 * on 2026-09-27, filling the memory compressor until macOS killed its own daemons in a loop), so
 * a run also refuses when kernel_task is already large.
 *
 * The lock is machine-wide (BROWSER_LOCK, under the user's home), not per repo: every checkout
 * and every game that uses this guard shares it, so they queue behind each other's browser runs.
 */
import { execFileSync } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync, unlinkSync, writeSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const E2E_MAX_WORKERS = 3; // ~2.4 GB each; safe since the trace-screenshot leak fix
export const E2E_MAX_REPEAT = 3;
const MIN_FREE_PERCENT = 30;
const MAX_KERNEL_GB = 20;
/** The one browser-run lock on this machine, shared by every repo that uses this guard. */
export const BROWSER_LOCK = join(homedir(), ".cache/browser-guard/lock");
const LOCK_POLL_MS = 2000;
const LOCK_WAIT_MS = 40 * 60_000;

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

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Blocks the thread for `ms` (the guard runs before anything async starts). */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Creates the lock file at `path` holding `<pid> <what>`, or returns its live holder's
 * description; clears a dead holder's lock first.
 */
export function tryLock(path: string, what: string): string | null {
  mkdirSync(dirname(path), { recursive: true });
  try {
    const fd = openSync(path, "wx");
    writeSync(fd, `${process.pid} ${what}\n`);
    closeSync(fd);
    return null;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    const [pid, ...rest] = readFileSync(path, "utf8").trim().split(" ");
    if (alive(Number(pid))) return `pid ${pid}: ${rest.join(" ")}`;
    unlinkSync(path); // stale: its owner died without releasing
    return tryLock(path, what);
  }
}

/**
 * Takes the machine's browser-run lock, waiting up to LOCK_WAIT_MS for the current holder (another
 * repo's or checkout's run), then refuses when free memory is under MIN_FREE_PERCENT or
 * kernel_task is too large. Returns the release function; it also runs on process exit.
 */
export function acquireBrowserLock(what: string): () => void {
  const deadline = Date.now() + LOCK_WAIT_MS;
  let holder = tryLock(BROWSER_LOCK, what);
  if (holder !== null) console.error(`${what}: waiting for the browser lock (${holder})`);
  while (holder !== null) {
    if (Date.now() > deadline)
      throw new Error(`${what}: ${BROWSER_LOCK} still held after 40 min (${holder})`);
    sleepSync(LOCK_POLL_MS);
    holder = tryLock(BROWSER_LOCK, what);
  }
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    unlinkSync(BROWSER_LOCK);
  };
  process.on("exit", release);
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
  return release;
}
