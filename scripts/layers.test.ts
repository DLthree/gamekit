import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The layers (docs/layout.md): core ← realtime ← game. Core never imports realtime, and reaches
 * the game only through CORE_SEAM; realtime reaches the game only through REALTIME_SEAM. A new
 * seam import goes in docs/layout.md's seam table and here.
 */
const CORE_SEAM = [
  "src/game/bots",
  "src/game/check",
  "src/game/content",
  "src/game/deeds",
  "src/game/handle",
  "src/game/links",
  "src/game/record",
  "src/game/scenario",
  "src/game/sweep",
  "src/game/switches",
  "src/game/telemetry",
  "src/game/test-files",
  "src/game/url",
];
const REALTIME_SEAM = [
  "src/game/behaviors",
  "src/game/bots",
  "src/game/headless",
  "src/game/links",
  "src/game/report",
  "src/game/scenario",
  "src/game/setup",
  "src/game/test-files",
  "src/game/vocab",
  "src/game/wave/director",
  "src/game/wave/tick",
];

type Layer = "core" | "realtime" | "game";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
/** Kit files outside src/, scripts/ and desktop/; the other specs under tests/ are the game's. */
const KIT_TEST_FILES = [
  "tests/e2e/fixtures.ts",
  "tests/deck/pad.ts",
  "tests/deck/setup.ts",
  "tests/deck/teardown.ts",
  "tests/desktop/smoke.spec.ts",
  "tests/e2e/turn-clock.spec.ts",
  "tests/fixtures/turn/main.ts",
];
const ALIASES: readonly (readonly [string, string])[] = [
  ["@/", "src/"],
  ["@scripts/", "scripts/"],
  ["@desktop/", "desktop/"],
  ["@deck/", "tests/deck/"],
  ["@e2e/", "tests/e2e/"],
];

/** A file's layer; `path` is a file or an import's module (no .ts). */
function layerOf(path: string): Layer {
  if (KIT_TEST_FILES.includes(path.endsWith(".ts") ? path : `${path}.ts`)) return "core";
  if (path.startsWith("src/game/") || path.startsWith("tests/")) return "game";
  if (path.startsWith("src/realtime/") || path.startsWith("scripts/realtime/")) return "realtime";
  return "core";
}

function tsFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = `${dir}/${name}`;
    if (statSync(join(ROOT, path)).isDirectory()) return name === "dist" ? [] : tsFiles(path);
    return path.endsWith(".ts") ? [path] : [];
  });
}

const IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*)"([^"]+)"/g;

/** The repo modules (path without .ts) a file imports through the aliases. */
function importsOf(path: string): string[] {
  const text = readFileSync(join(ROOT, path), "utf8");
  return [...text.matchAll(IMPORT)].flatMap(([, spec]) => {
    const alias = ALIASES.find(([prefix]) => spec.startsWith(prefix));
    return alias === undefined ? [] : [alias[1] + spec.slice(alias[0].length)];
  });
}

const files = [...tsFiles("src"), ...tsFiles("scripts"), ...tsFiles("desktop"), ...KIT_TEST_FILES];
const edges = files.flatMap((from) => importsOf(from).map((to) => ({ from, to })));

/** `from → to` for each import its layer may not make. */
function violations(): string[] {
  return edges.flatMap(({ from, to }) => {
    const [a, b] = [layerOf(from), layerOf(to)];
    const bad =
      (a === "core" && b === "realtime") ||
      (a === "core" && b === "game" && !CORE_SEAM.includes(to)) ||
      (a === "realtime" && b === "game" && !REALTIME_SEAM.includes(to));
    return bad ? [`${from} (${a}) → ${to} (${b})`] : [];
  });
}

describe("layers", () => {
  it("finds the files and their imports", () => {
    expect(files).toContain("src/content/compile.ts");
    expect(files).toContain("tests/e2e/fixtures.ts");
    expect(importsOf("src/content/compile.ts")).toContain("src/game/content");
  });

  it("core imports neither realtime nor the game outside the seam; realtime only the seam", () => {
    expect(violations()).toEqual([]);
  });

  it("lists only seam modules that exist and are imported across it", () => {
    const used = (layer: Layer) =>
      new Set(edges.filter((e) => layerOf(e.from) === layer).map((e) => e.to));
    const stale = [
      ...CORE_SEAM.filter((m) => !used("core").has(m)),
      ...REALTIME_SEAM.filter((m) => !used("realtime").has(m)),
    ];
    expect(stale).toEqual([]);
  });
});
