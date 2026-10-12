/**
 * The game's publish settings, `ship/config.json` (the game owns it): the app's name and bundle
 * id, its Steam App ID and depot IDs, its itch.io page. A new game starts with "TODO" placeholders;
 * the steps that need a value (the Steam build, `steam:upload`, `itch:push`) fail fast, naming
 * each placeholder still there, and nothing else reads them.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

export const SHIP_FILE = "ship/config.json";
const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** A Steam ID, or a "TODO…" placeholder a new game hasn't filled in yet. */
const SteamId = z.union([z.number().int().positive(), z.string().startsWith("TODO")]);

export const ShipConfig = z.strictObject({
  productName: z.string().min(1),
  /** The bundle id (macOS) and app user model id (Windows), reverse-DNS. */
  appId: z.string().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i),
  /** The binary's name on Linux (the Deck runs it). */
  executableName: z.string().regex(/^[a-z0-9-]+$/),
  steam: z.strictObject({
    appId: SteamId,
    depots: z.strictObject({ win: SteamId, mac: SteamId, linux: SteamId }),
  }),
  /** `<itch user>/<game>`, the butler target. */
  itch: z.strictObject({ target: z.string() }),
});
export type ShipConfig = z.infer<typeof ShipConfig>;

/** ship/config.json, checked. Throws naming the file and field. */
export function readShip(root = ROOT): ShipConfig {
  const file = join(root, SHIP_FILE);
  const r = ShipConfig.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!r.success)
    throw new Error(
      `${SHIP_FILE}: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  return r.data;
}

/** Spacewar, Valve's test app: the shell may run on it, but nothing is uploaded to it. */
export const SPACEWAR_APP_ID = 480;

export interface SteamIds {
  appId: number;
  depots: { win: number; mac: number; linux: number };
}

/** The Steam IDs, or an error naming every placeholder still in ship/config.json. */
export function steamIds(ship: ShipConfig): SteamIds {
  const { appId, depots } = ship.steam;
  const todo = [
    ["steam.appId", appId],
    ...Object.entries(depots).map(([os, id]) => [`steam.depots.${os}`, id]),
  ]
    .filter(([, v]) => typeof v === "string")
    .map(([k]) => k);
  if (todo.length > 0 || typeof appId === "string")
    throw new Error(`${SHIP_FILE}: fill in the Steam IDs first: ${todo.join(", ")} still TODO`);
  return { appId, depots: depots as SteamIds["depots"] };
}

/** The itch target `<user>/<game>`, or an error while it's a placeholder or malformed. */
export function itchTarget(ship: ShipConfig): string {
  const { target } = ship.itch;
  if (target.includes("TODO"))
    throw new Error(`${SHIP_FILE}: fill in itch.target (<itch user>/<game>) first`);
  if (!/^[\w-]+\/[\w-]+$/.test(target))
    throw new Error(`${SHIP_FILE}: itch.target ${target}: expected <itch user>/<game>`);
  return target;
}
