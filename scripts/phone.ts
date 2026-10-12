/**
 * pnpm phone <ref>: build <ref> in the detached worktree .phone/ and serve it to the LAN on 5282,
 * with telemetry going to this checkout's telemetry/ folder.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT = 5282;

/** The grid, the diagonal (balanced), one cell above it (overkill) and one below (struggle). */
export function phoneUrls(ip: string, port: number): string[] {
  const base = `http://${ip}:${port}`;
  const cell = (b: number, t: number) => `${base}/?char=wizard&build=${b}&threat=${t}`;
  return [`${base}/`, cell(1, 1), cell(2, 2), cell(3, 3), cell(3, 1), cell(1, 3)];
}

function run(
  cmd: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return execFileSync(cmd, args, {
    cwd,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
}

/** ipconfig getifaddr en0, falling back to en1 (some Macs only have Wi-Fi on en1). */
function lanIp(repo: string): string {
  try {
    return run("ipconfig", ["getifaddr", "en0"], repo);
  } catch {
    return run("ipconfig", ["getifaddr", "en1"], repo);
  }
}

function main(): void {
  const ref = process.argv[2];
  if (ref === undefined) {
    console.error(
      "usage: pnpm phone <ref>   (a commit, branch or tag; the phone plays exactly that)",
    );
    process.exit(1);
  }
  const repo = run("git", ["rev-parse", "--show-toplevel"], process.cwd());
  const sha = run("git", ["rev-parse", "--verify", `${ref}^{commit}`], repo);
  const dir = resolve(repo, ".phone");
  if (existsSync(dir)) run("git", ["checkout", "--detach", sha], dir);
  else run("git", ["worktree", "add", "--detach", dir, sha], repo);
  run("pnpm", ["install", "--frozen-lockfile"], dir);
  run("pnpm", ["exec", "vite", "build"], dir, { ...process.env, VITE_PHONE: "1" });
  const ip = lanIp(repo);
  const env = { ...process.env, GAMEKIT_TELEMETRY_DIR: resolve(repo, "telemetry") };
  const preview = spawn(
    "pnpm",
    ["exec", "vite", "preview", "--host", "0.0.0.0", "--port", String(PORT), "--strictPort"],
    { cwd: dir, env, stdio: "inherit" },
  );
  console.log(`\nPhone build of ${ref} (${sha.slice(0, 7)}):`);
  for (const url of phoneUrls(ip, PORT)) console.log(`  ${url}`);
  console.log("Telemetry: pnpm telemetry\n");
  preview.on("exit", (code) => process.exit(code ?? 0));
}

if (import.meta.main) main();
