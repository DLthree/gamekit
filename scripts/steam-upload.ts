/**
 * pnpm steam:upload [--desc "<build note>"] [--upload --user <steam login>]
 *
 * Writes the SteamPipe build scripts into release/steampipe/: app_build_<app>.vdf and one
 * depot_build_<depot>.vdf per OS (the IDs in ship/config.json), each depot holding that OS's
 * packaged Steam build from `pnpm desktop:dist --steam`. A dry run by default: it stops there
 * and prints the steamcmd command. Only `--upload` runs it (steamcmd asks for the password and
 * Steam Guard code); the build is uploaded, not set live (the dashboard's Builds page does that).
 *
 * Refuses while ship/config.json's Steam IDs are placeholders or Spacewar's (480), and uploads
 * only from macOS: the mac app's framework symlinks break when uploaded from Windows.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { readShip, SPACEWAR_APP_ID, type SteamIds, steamIds } from "@desktop/ship";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "release", "steampipe");

type Os = keyof SteamIds["depots"];

/** Each OS's packaged Steam app folder (electron-builder's unpacked output). */
export const DEPOT_CONTENT: Record<Os, string> = {
  win: "release/steam/win-unpacked",
  mac: "release/steam/mac-universal",
  linux: "release/steam/linux-unpacked",
};

const q = (v: string | number) => `"${String(v).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;

/** The app build script: the depots it builds, its log folder, its description. */
export function appBuildVdf(appId: number, depots: readonly number[], desc: string): string {
  return [
    '"AppBuild"',
    "{",
    `\t"AppID"\t${q(appId)}`,
    `\t"Desc"\t${q(desc)}`,
    `\t"BuildOutput"\t${q("output/")}`,
    `\t"ContentRoot"\t${q("")}`,
    `\t"SetLive"\t${q("")}`,
    '\t"Depots"',
    "\t{",
    ...depots.map((d) => `\t\t${q(d)}\t${q(`depot_build_${d}.vdf`)}`),
    "\t}",
    "}",
    "",
  ].join("\n");
}

/** A depot build script: everything under `contentRoot`, recursively, at the depot's root. */
export function depotBuildVdf(depotId: number, contentRoot: string): string {
  return [
    '"DepotBuild"',
    "{",
    `\t"DepotID"\t${q(depotId)}`,
    `\t"ContentRoot"\t${q(contentRoot)}`,
    '\t"FileMapping"',
    "\t{",
    `\t\t"LocalPath"\t${q("*")}`,
    `\t\t"DepotPath"\t${q(".")}`,
    `\t\t"Recursive"\t${q("1")}`,
    "\t}",
    "}",
    "",
  ].join("\n");
}

/** The game's Steam IDs for an upload: filled in, and not Spacewar's. */
export function uploadIds(ids: SteamIds): SteamIds {
  if (ids.appId === SPACEWAR_APP_ID)
    throw new Error(
      `ship/config.json: steam.appId is Spacewar's (${SPACEWAR_APP_ID}), Valve's test app: set the game's own`,
    );
  return ids;
}

const USAGE = `usage: pnpm steam:upload [--desc "<build note>"] [--upload --user <steam login>]`;

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
  const { values } = parseArgs({
    options: {
      upload: { type: "boolean", default: false },
      user: { type: "string" },
      desc: { type: "string" },
    },
  });
  const ids = orFail(() => uploadIds(steamIds(readShip(ROOT))));
  const oses = Object.keys(ids.depots) as Os[];
  const missing = oses.filter((os) => !existsSync(join(ROOT, DEPOT_CONTENT[os])));
  mkdirSync(OUT, { recursive: true });
  for (const os of oses)
    writeFileSync(
      join(OUT, `depot_build_${ids.depots[os]}.vdf`),
      depotBuildVdf(ids.depots[os], join(ROOT, DEPOT_CONTENT[os])),
    );
  const { version } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
    version: string;
  };
  const appVdf = join(OUT, `app_build_${ids.appId}.vdf`);
  writeFileSync(
    appVdf,
    appBuildVdf(ids.appId, Object.values(ids.depots), values.desc ?? `v${version}`),
  );
  console.log(`${relative(ROOT, OUT)}: app build ${ids.appId}, depots ${oses.join(", ")}`);
  const args = ["+login", values.user ?? "<steam login>", "+run_app_build", appVdf, "+quit"];
  if (!values.upload) {
    console.log(
      `dry run; to upload: steamcmd ${args.join(" ")}  (pnpm steam:upload --upload --user <login>)`,
    );
    if (missing.length > 0)
      console.log(`not built yet: ${missing.map((os) => DEPOT_CONTENT[os]).join(", ")}`);
    return;
  }
  if (values.user === undefined) fail("--upload needs --user <steam login>");
  if (process.platform !== "darwin")
    fail("upload from macOS: the mac depot's framework symlinks break otherwise");
  if (missing.length > 0)
    fail(
      `build the Steam app first (pnpm desktop:dist --steam): missing ${missing.map((os) => DEPOT_CONTENT[os]).join(", ")}`,
    );
  execFileSync("steamcmd", args, { stdio: "inherit" });
}

if (import.meta.main) main();
