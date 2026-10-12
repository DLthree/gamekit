/**
 * pnpm desktop:compile --steam|--itch
 * pnpm desktop:dist --steam|--itch [--mac] [--win] [--linux] [--dir]
 *
 * The desktop app's two flavours: `steam` (Steamworks via steamworks-ffi-node, with our copy of
 * the SDK library) and `itch` (DRM-free: no Steam code). `compile` bundles desktop/ into
 * desktop/dist/ for that flavour; `dist` (after `pnpm build`) packages it with electron-builder
 * into release/<flavour>/, for every OS unless some are named; `--dir` leaves the unpacked app
 * only (no installer). The app's name and ids come from ship/config.json; the steam flavour
 * fails fast while its Steam IDs are placeholders or the SDK files for an OS it builds are
 * missing (vendor/steamworks_sdk/).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { readShip, type ShipConfig, steamIds } from "@desktop/ship";
import { STEAM_LIBRARIES } from "@desktop/steam";
import { build } from "esbuild";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const VENDOR_SDK = join(ROOT, "vendor", "steamworks_sdk");

export type Flavour = "steam" | "itch";
export type Os = "mac" | "win" | "linux";

const OS_PLATFORM = { mac: "darwin", win: "win32", linux: "linux" } as const;

/** steamworks-ffi-node and its FFI layer: the only node_modules the Steam build ships. */
const STEAM_MODULES = [
  "node_modules/steamworks-ffi-node/**",
  "node_modules/koffi/**",
  "node_modules/@koromix/**",
];

/** The SDK library folder for an OS, from the repo's vendor/ to the app's Resources/. */
function sdkResource(os: Os): { from: string; to: string } {
  const dir = STEAM_LIBRARIES[OS_PLATFORM[os]].split("/").slice(0, -1).join("/");
  return { from: `vendor/steamworks_sdk/${dir}`, to: `steamworks_sdk/${dir}` };
}

/**
 * electron-builder's config for a flavour. Unsigned (no signing identity). The game is bundled
 * into dist/ by vite and the shell into desktop/dist/ by esbuild, so the itch app needs no
 * node_modules; the Steam app adds the binding, unpacked from the asar so its native libraries
 * load, and the SDK library in Resources/steamworks_sdk/.
 */
export function builderConfig(flavour: Flavour, ship: ShipConfig): Record<string, unknown> {
  const steam = flavour === "steam";
  const extra = (os: Os) => (steam ? { extraResources: [sdkResource(os)] } : {});
  return {
    appId: ship.appId,
    productName: ship.productName,
    // electron-builder fills the escaped ${…} itself.
    artifactName: `${ship.executableName}-\${version}-\${os}-\${arch}.\${ext}`,
    directories: { output: `release/${flavour}`, buildResources: "ship" },
    files: [
      "package.json",
      "dist/**",
      "desktop/dist/**",
      "!**/node_modules/**",
      ...(steam ? STEAM_MODULES : []),
    ],
    asar: true,
    ...(steam ? { asarUnpack: STEAM_MODULES } : {}),
    npmRebuild: false,
    icon: "ship/icon.png",
    mac: {
      category: "public.app-category.games",
      identity: null,
      target: [
        { target: "dmg", arch: ["universal"] },
        { target: "zip", arch: ["universal"] },
      ],
      ...(steam
        ? {
            hardenedRuntime: true,
            entitlements: "desktop/entitlements.mac.plist",
            entitlementsInherit: "desktop/entitlements.mac.plist",
            // koffi ships one binary per arch: each half of the universal app keeps both.
            x64ArchFiles: "**/node_modules/{koffi,@koromix,steamworks-ffi-node}/**",
          }
        : {}),
      ...extra("mac"),
    },
    win: {
      target: [
        { target: "nsis", arch: ["x64"] },
        { target: "zip", arch: ["x64"] },
      ],
      ...extra("win"),
    },
    nsis: { oneClick: false, allowToChangeInstallationDirectory: true },
    // The Steam Deck runs the Linux build natively.
    linux: {
      category: "Game",
      executableName: ship.executableName,
      target: [
        { target: "AppImage", arch: ["x64"] },
        { target: "dir", arch: ["x64"] },
      ],
      ...extra("linux"),
    },
  };
}

/** The OSes picked; all three when none is named. */
export function targetOses(picked: { mac?: boolean; win?: boolean; linux?: boolean }): Os[] {
  const oses = (["mac", "win", "linux"] as const).filter((os) => picked[os] === true);
  return oses.length === 0 ? ["mac", "win", "linux"] : oses;
}

/** The SDK library files the Steam build needs for these OSes that `sdkDir` lacks. */
export function missingSdkFiles(oses: readonly Os[], sdkDir: string): string[] {
  return oses
    .map((os) => join(sdkDir, STEAM_LIBRARIES[OS_PLATFORM[os]]))
    .filter((f) => !existsSync(f));
}

/**
 * Bundles the shell for a flavour into `outdir` (desktop/dist/ for the app); the itch bundle is
 * checked to hold no Steam code. The steam flavour takes its App ID from ship/config.json (a
 * test may pass one), so it fails here while that's a placeholder.
 */
export async function compileShell(
  flavour: Flavour,
  outdir = join(ROOT, "desktop/dist"),
  steamAppId: number | null = null,
): Promise<void> {
  const appId = flavour === "itch" ? 0 : (steamAppId ?? steamIds(readShip(ROOT)).appId);
  await build({
    entryPoints: [join(ROOT, "desktop/main.ts"), join(ROOT, "desktop/preload.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node24",
    external: ["electron", "steamworks-ffi-node"],
    outdir,
    outExtension: { ".js": ".cjs" },
    define: {
      __STEAM__: JSON.stringify(flavour === "steam"),
      __STEAM_APP_ID__: JSON.stringify(appId),
    },
    logLevel: "warning",
  });
  if (flavour === "itch")
    for (const f of ["main.cjs", "preload.cjs"]) {
      const text = readFileSync(join(outdir, f), "utf8");
      if (/steamworks|steam-main|steam-ffi/i.test(text))
        throw new Error(`${join(outdir, f)}: the itch build holds Steam code`);
    }
  console.log(`${outdir}: ${flavour} build`);
}

const USAGE = `usage: pnpm desktop:compile --steam|--itch
       pnpm desktop:dist --steam|--itch [--mac] [--win] [--linux] [--dir]`;

const fail = (why: string): never => {
  console.error(`${why}\n${USAGE}`);
  process.exit(1);
};

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      steam: { type: "boolean", default: false },
      itch: { type: "boolean", default: false },
      mac: { type: "boolean", default: false },
      win: { type: "boolean", default: false },
      linux: { type: "boolean", default: false },
      dir: { type: "boolean", default: false },
    },
  });
  const [cmd] = positionals;
  if (cmd !== "compile" && cmd !== "dist") fail(`unknown command ${cmd}: compile or dist`);
  if (values.steam === values.itch) fail("name one flavour: --steam or --itch");
  const flavour: Flavour = values.steam ? "steam" : "itch";
  const ship = readShip(ROOT);
  // A placeholder Steam ID stops the steam flavour here, with ship/config.json's own words.
  await compileShell(flavour).catch((err: unknown) =>
    fail(err instanceof Error ? err.message : String(err)),
  );
  if (cmd === "compile") return;
  if (!existsSync(join(ROOT, "dist", "index.html"))) fail("no dist/: run pnpm build first");
  const oses = targetOses(values);
  if (flavour === "steam") {
    const missing = missingSdkFiles(oses, VENDOR_SDK);
    if (missing.length > 0)
      fail(
        [
          "The Steam build needs the Steamworks SDK's redistributable libraries, missing:",
          ...missing.map((f) => `  ${f}`),
          "Download the SDK from https://partner.steamgames.com/downloads/list (Steamworks login),",
          "and copy sdk/redistributable_bin/{osx,linux64,win64} into vendor/steamworks_sdk/redistributable_bin/.",
        ].join("\n"),
      );
  }
  const configDir = join(ROOT, "release");
  mkdirSync(configDir, { recursive: true });
  const configFile = join(configDir, `builder-${flavour}.json`);
  writeFileSync(configFile, `${JSON.stringify(builderConfig(flavour, ship), null, 2)}\n`);
  const args = [...oses.map((os) => `--${os}`), ...(values.dir ? ["--dir"] : [])];
  execFileSync("pnpm", ["exec", "electron-builder", "--config", configFile, ...args], {
    cwd: ROOT,
    stdio: "inherit",
  });
}

if (import.meta.main) await main();
