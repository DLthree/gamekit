import { checkContent } from "@/content/check";
import type { ContentError } from "@/content/errors";
import { isKind, type Kind, type KindTree } from "@/content/kind";
import { KIT_KINDS, schemaRefFor } from "@/content/kinds";
import { applyOverrides, isOverride, type Override, parseOverride } from "@/content/overrides";
import type { Content } from "@/content/types";
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

export function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** Compiles every kind in `tree`; null when one single file is missing or invalid. */
function compileTree(
  files: Readonly<Record<string, unknown>>,
  tree: KindTree,
  claimed: Set<string>,
  errors: ContentError[],
): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  let ok = true;
  for (const [key, node] of Object.entries(tree)) {
    const value = isKind(node)
      ? node.collection
        ? collection(files, node, claimed, errors)
        : single(files, node, claimed, errors)
      : compileTree(files, node, claimed, errors);
    if (value === null) ok = false;
    out[key] = value;
  }
  return ok ? out : null;
}

/** Parsed JSON files → one valid, frozen Content, or every error found. */
export function compileContent(files: Readonly<Record<string, unknown>>): CompileResult {
  const errors: ContentError[] = [];
  const claimed = new Set<string>();
  const gameSim = compileTree(files, GAME_KINDS.sim, claimed, errors);
  const gameLook = compileTree(files, GAME_KINDS.look, claimed, errors);
  const kitLook = compileTree(files, KIT_KINDS.look, claimed, errors);
  for (const file of Object.keys(files).sort()) {
    if (!claimed.has(file)) errors.push({ file, path: "", message: "not a known content file" });
  }
  if (errors.length > 0 || gameSim === null || gameLook === null || kitLook === null) {
    return { ok: false, errors };
  }
  // The trees' shapes are SimContent and LookContent by construction (Compiled<…>).
  const content = {
    sim: gameSim,
    look: { ...gameLook, ...kitLook },
  } as unknown as Content;
  const crossErrors = checkContent(content);
  if (crossErrors.length > 0) return { ok: false, errors: crossErrors };
  return { ok: true, content: deepFreeze(content) };
}
