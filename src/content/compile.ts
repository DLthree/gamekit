import { checkContent } from "@/content/check";
import type { ContentError } from "@/content/errors";
import { KINDS, type Kind, schemaRefFor } from "@/content/kinds";
import { applyOverrides, isOverride, type Override, parseOverride } from "@/content/overrides";
import type { Content, GameSimContent } from "@/content/types";
import { GAME_KINDS } from "@/game/content";

export type CompileResult = { ok: true; content: Content } | { ok: false; errors: ContentError[] };

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Raw texts → parsed JSON. A syntax error names the file (a half-saved file under pnpm dev). */
export function parseJsonTexts(texts: Readonly<Record<string, string>>): {
  files: Record<string, unknown>;
  errors: ContentError[];
} {
  const files: Record<string, unknown> = {};
  const errors: ContentError[] = [];
  for (const file of Object.keys(texts).sort()) {
    try {
      files[file] = JSON.parse(texts[file]);
    } catch (e) {
      errors.push({ file, path: "", message: `invalid JSON: ${(e as Error).message}` });
    }
  }
  return { files, errors };
}

/** Texts + URL overrides → content, the one entry point the loaders use. */
export function buildContent(
  texts: Readonly<Record<string, string>>,
  overrides: readonly string[],
): CompileResult {
  const parsed = parseJsonTexts(texts);
  const patches: Override[] = [];
  const errors = [...parsed.errors];
  for (const raw of overrides) {
    const o = parseOverride(raw);
    if (isOverride(o)) patches.push(o);
    else errors.push(o);
  }
  if (errors.length > 0) return { ok: false, errors };
  const applied = applyOverrides(parsed.files, patches);
  if (applied.errors.length > 0) return { ok: false, errors: applied.errors };
  return compileContent(applied.files);
}

function issuePath(path: readonly PropertyKey[]): string {
  return path.map(String).join(".");
}

function parseFile<T>(
  file: string,
  body: unknown,
  kind: Kind<T>,
  errors: ContentError[],
): T | null {
  const r = kind.schema.safeParse(body);
  if (!r.success) {
    for (const issue of r.error.issues) {
      errors.push({ file, path: issuePath(issue.path), message: issue.message });
    }
    return null;
  }
  const expected = schemaRefFor(file, kind.schemaName);
  const ref = (body as { $schema: unknown }).$schema;
  if (ref !== expected) {
    errors.push({ file, path: "$schema", message: `expected ${expected}` });
    return null;
  }
  return r.data;
}

function collection<T>(
  files: Readonly<Record<string, unknown>>,
  kind: Kind<T>,
  claimed: Set<string>,
  errors: ContentError[],
): Record<string, T> {
  const out: Record<string, T> = {};
  const prefix = `${kind.path}/`;
  for (const file of Object.keys(files).sort()) {
    const rest = file.slice(prefix.length);
    if (!file.startsWith(prefix) || rest.includes("/") || !rest.endsWith(".json")) continue;
    claimed.add(file);
    const id = rest.slice(0, -".json".length);
    if (!KEBAB.test(id)) {
      errors.push({ file, path: "", message: "file names are kebab-case ids" });
      continue;
    }
    const value = parseFile(file, files[file], kind, errors);
    if (value !== null) out[id] = value;
  }
  return out;
}

function single<T>(
  files: Readonly<Record<string, unknown>>,
  kind: Kind<T>,
  claimed: Set<string>,
  errors: ContentError[],
): T | null {
  const file = `${kind.path}.json`;
  claimed.add(file);
  if (!Object.hasOwn(files, file)) {
    errors.push({ file, path: "", message: "missing" });
    return null;
  }
  return parseFile(file, files[file], kind, errors);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** Parsed JSON files → one valid, frozen Content, or every error found. */
export function compileContent(files: Readonly<Record<string, unknown>>): CompileResult {
  const errors: ContentError[] = [];
  const claimed = new Set<string>();
  const characters = collection(files, KINDS.characters, claimed, errors);
  const skills = collection(files, KINDS.skills, claimed, errors);
  const modifiers = collection(files, KINDS.modifiers, claimed, errors);
  const enemies = collection(files, KINDS.enemies, claimed, errors);
  const arena = single(files, KINDS.arena, claimed, errors);
  const movement = single(files, KINDS.movement, claimed, errors);
  const feel = single(files, KINDS.feel, claimed, errors);
  const limits = single(files, KINDS.limits, claimed, errors);
  const palette = single(files, KINDS.palette, claimed, errors);
  const lookCharacters = single(files, KINDS.lookCharacters, claimed, errors);
  const creatures = single(files, KINDS.creatures, claimed, errors);
  const fx = single(files, KINDS.fx, claimed, errors);
  const feedback = single(files, KINDS.feedback, claimed, errors);
  const camera = single(files, KINDS.camera, claimed, errors);
  const controls = single(files, KINDS.controls, claimed, errors);
  const layers = single(files, KINDS.layers, claimed, errors);
  const sprites = single(files, KINDS.sprites, claimed, errors);
  const sounds = single(files, KINDS.sounds, claimed, errors);
  const soundManifest = single(files, KINDS.soundManifest, claimed, errors);
  const game = Object.fromEntries(
    Object.entries(GAME_KINDS).map(([key, kind]) => [
      key,
      collection<unknown>(files, kind, claimed, errors),
    ]),
  ) as GameSimContent;
  for (const file of Object.keys(files).sort()) {
    if (!claimed.has(file)) errors.push({ file, path: "", message: "not a known content file" });
  }
  if (
    errors.length > 0 ||
    arena === null ||
    movement === null ||
    feel === null ||
    limits === null ||
    palette === null ||
    lookCharacters === null ||
    creatures === null ||
    fx === null ||
    feedback === null ||
    camera === null ||
    controls === null ||
    layers === null ||
    sprites === null ||
    sounds === null ||
    soundManifest === null
  ) {
    return { ok: false, errors };
  }
  const content: Content = {
    sim: {
      characters,
      skills,
      modifiers,
      enemies,
      ...game,
      rules: { arena, movement, feel, limits },
    },
    look: {
      palette,
      characters: lookCharacters,
      creatures,
      fx,
      feedback,
      camera,
      controls,
      layers,
      sprites,
      sounds,
      soundManifest,
    },
  };
  const crossErrors = checkContent(content);
  if (crossErrors.length > 0) return { ok: false, errors: crossErrors };
  return { ok: true, content: deepFreeze(content) };
}
