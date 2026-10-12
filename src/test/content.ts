import { compileContent } from "@/content/compile";
import { formatContentError } from "@/content/errors";
import { KINDS, schemaRefFor } from "@/content/kinds";
import type { Content } from "@/content/types";
import { GAME_TEST_FILES } from "@/game/test-files";

/** path → replacement file (without `$schema`, which is inserted), or null to delete the file. */
export type FilePatch = Record<string, unknown>;

/** The kit's own kinds in the test content: two sounds. The game's files come from GAME_TEST_FILES. */
const KIT_TEST_FILES: Record<string, Record<string, unknown>> = {
  "look/sounds.json": {
    volume: 1,
    sounds: {
      tick: { cap: 2, minGapS: 0.05, volume: 0.5, pitch: 1, loop: false },
      chime: { cap: 2, minGapS: 0.05, volume: 0.5, pitch: 1, loop: false },
    },
  },
  "look/generated/sounds.json": {
    sounds: [
      { id: "tick", file: "sounds/tick.wav", lengthS: 0.1 },
      { id: "chime", file: "sounds/chime.wav", lengthS: 0.4 },
    ],
  },
};

function schemaNameFor(file: string): string {
  for (const kind of Object.values(KINDS)) {
    const owned = kind.collection
      ? file.startsWith(`${kind.path}/`) && !file.slice(kind.path.length + 1).includes("/")
      : file === `${kind.path}.json`;
    if (owned) return kind.schemaName;
  }
  throw new Error(`testFiles: ${file} is not a content kind`);
}

/** The base test files with `patch` applied; `$schema` is inserted where missing. */
export function testFiles(patch: FilePatch = {}): Record<string, unknown> {
  const files: Record<string, unknown> = {};
  const merged: Record<string, unknown> = { ...KIT_TEST_FILES, ...GAME_TEST_FILES, ...patch };
  for (const [file, body] of Object.entries(merged)) {
    if (body === null) continue;
    if (typeof body !== "object") throw new Error(`testFiles: ${file} must be an object or null`);
    files[file] = { $schema: schemaRefFor(file, schemaNameFor(file)), ...body };
  }
  return files;
}

/** The same files as JSON texts, the form the loaders produce. */
export function testTexts(patch: FilePatch = {}): Record<string, string> {
  const texts: Record<string, string> = {};
  for (const [file, body] of Object.entries(testFiles(patch))) texts[file] = JSON.stringify(body);
  return texts;
}

/** Compiled test content; invalid content throws with every error, file and field. */
export function testContent(patch: FilePatch = {}): Content {
  const r = compileContent(testFiles(patch));
  if (!r.ok) throw new Error(r.errors.map(formatContentError).join("\n"));
  return r.content;
}
