/**
 * pnpm itch:push [--upload]
 *
 * Pushes the itch (DRM-free) build from `pnpm desktop:dist --itch` with butler to the target in
 * ship/config.json (`itch.target`, <user>/<game>), one channel per OS: mac, windows, linux. A dry
 * run by default: it prints the butler commands. Only `--upload` runs them (`butler login` once
 * first). The version is package.json's.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { itchTarget, readShip } from "@desktop/ship";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Each itch channel's packaged app folder (electron-builder's unpacked output). */
const ITCH_CHANNELS = {
  mac: "release/itch/mac-universal",
  windows: "release/itch/win-unpacked",
  linux: "release/itch/linux-unpacked",
} as const;

/** butler's arguments for each channel. */
export function butlerPushes(target: string, version: string): string[][] {
  return Object.entries(ITCH_CHANNELS).map(([channel, dir]) => [
    "push",
    dir,
    `${target}:${channel}`,
    "--userversion",
    version,
  ]);
}

const USAGE = "usage: pnpm itch:push [--upload]";

const fail = (why: string): never => {
  console.error(`${why}\n${USAGE}`);
  process.exit(1);
};

/** `f`'s value, or its error's message through fail (ship/config.json's placeholders). */
function orFail<T>(f: () => T): T {
  try {
    return f();
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
}

function main(): void {
  const { values } = parseArgs({ options: { upload: { type: "boolean", default: false } } });
  const target = orFail(() => itchTarget(readShip(ROOT)));
  const { version } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
    version: string;
  };
  const pushes = butlerPushes(target, version);
  if (!values.upload) {
    for (const args of pushes) console.log(`butler ${args.join(" ")}`);
    console.log("dry run; add --upload to run these");
    return;
  }
  const missing = Object.values(ITCH_CHANNELS).filter((dir) => !existsSync(join(ROOT, dir)));
  if (missing.length > 0)
    fail(`build the itch app first (pnpm desktop:dist --itch): missing ${missing.join(", ")}`);
  for (const args of pushes) execFileSync("butler", args, { cwd: ROOT, stdio: "inherit" });
}

if (import.meta.main) main();
