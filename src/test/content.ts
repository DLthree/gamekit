import { compileContent } from "@/content/compile";
import { formatContentError } from "@/content/errors";
import { KINDS, SIM_KINDS, schemaRefFor } from "@/content/kinds";
import { REPO_CONTENT_DIR, readContentTexts } from "@/content/load-node";
import type { Content } from "@/content/types";

/**
 * Content for kit tests. Core tests reach the game's files only by discovery: the repo's own
 * content/ (`testFiles`), patched, and `aCollection()` / `aSimEdit()`, never a game file by name;
 * a test that needs something the game lacks skips (`it.skipIf`). Another layer builds its own
 * small fixture with `contentFixture` (src/realtime/test/content.ts).
 */

/** path → replacement file (without `$schema`, which is inserted), or null to delete the file. */
export type FilePatch = Record<string, unknown>;

/** The kit's own kinds as a tiny fixture: two sounds. A layer's fixture spreads it in. */
export const KIT_TEST_FILES: Record<string, Record<string, unknown>> = {
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
  for (const kind of KINDS) {
    const owned = kind.collection
      ? file.startsWith(`${kind.path}/`) && !file.slice(kind.path.length + 1).includes("/")
      : file === `${kind.path}.json`;
    if (owned) return kind.schemaName;
  }
  throw new Error(`testFiles: ${file} is not a content kind`);
}

export interface ContentFixture {
  /** The base files with `patch` applied; `$schema` is inserted where missing. */
  testFiles(patch?: FilePatch): Record<string, unknown>;
  /** The same files as JSON texts, the form the loaders produce. */
  testTexts(patch?: FilePatch): Record<string, string>;
  /** Compiled; invalid content throws with every error, file and field. */
  testContent(patch?: FilePatch): Content;
}

/** Test helpers over `base()`'s files. */
export function contentFixture(base: () => FilePatch): ContentFixture {
  const testFiles = (patch: FilePatch = {}): Record<string, unknown> => {
    const files: Record<string, unknown> = {};
    for (const [file, body] of Object.entries({ ...base(), ...patch })) {
      if (body === null) continue;
      if (typeof body !== "object") throw new Error(`testFiles: ${file} must be an object or null`);
      files[file] = { $schema: schemaRefFor(file, schemaNameFor(file)), ...body };
    }
    return files;
  };
  const testTexts = (patch: FilePatch = {}): Record<string, string> => {
    const texts: Record<string, string> = {};
    for (const [file, body] of Object.entries(testFiles(patch))) texts[file] = JSON.stringify(body);
    return texts;
  };
  const testContent = (patch: FilePatch = {}): Content => {
    const r = compileContent(testFiles(patch));
    if (!r.ok) throw new Error(r.errors.map(formatContentError).join("\n"));
    return r.content;
  };
  return { testFiles, testTexts, testContent };
}

/** The repo's content/ files, parsed. */
function repoFiles(): FilePatch {
  const files: FilePatch = {};
  for (const [file, text] of Object.entries(readContentTexts(REPO_CONTENT_DIR)))
    files[file] = JSON.parse(text);
  return files;
}

export const { testFiles, testTexts, testContent } = contentFixture(repoFiles);

/** The first file of the game's first collection kind with one (folder, path and parsed body), or null. */
export function aCollection(): { folder: string; file: string; body: unknown } | null {
  const files = testFiles();
  for (const kind of KINDS) {
    if (!kind.collection) continue;
    const file = Object.keys(files)
      .sort()
      .find((f) => f.startsWith(`${kind.path}/`) && !f.slice(kind.path.length + 1).includes("/"));
    if (file !== undefined) return { folder: kind.path, file, body: files[file] };
  }
  return null;
}

/** A valid edit of the rules (sim) content, found without naming a game file: a copy of some
 * sim collection's file. Null when no such copy compiles. */
export function aSimEdit(): FilePatch | null {
  const files = testFiles();
  for (const kind of SIM_KINDS) {
    if (!kind.collection) continue;
    const file = Object.keys(files)
      .sort()
      .find((f) => f.startsWith(`${kind.path}/`) && !f.slice(kind.path.length + 1).includes("/"));
    if (file === undefined) continue;
    const patch = { [`${kind.path}/zz-copy.json`]: files[file] };
    if (compileContent(testFiles(patch)).ok) return patch;
  }
  return null;
}
