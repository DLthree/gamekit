import type { ContentError } from "@/content/errors";

/** A URL `o=` patch: `<folder>/<file>.<field.path>=<JSON value>`. */
export interface Override {
  raw: string;
  file: string;
  path: readonly string[];
  value: unknown;
}

function fail(raw: string, message: string): ContentError {
  return { file: "(url override)", path: raw, message };
}

export function isOverride(x: Override | ContentError): x is Override {
  return "value" in x;
}

export function parseOverride(raw: string): Override | ContentError {
  const eq = raw.indexOf("=");
  if (eq <= 0) return fail(raw, "expected <folder>/<file>.<field path>=<JSON value>");
  const lhs = raw.slice(0, eq);
  const rhs = raw.slice(eq + 1);
  const slash = lhs.lastIndexOf("/");
  const dot = lhs.indexOf(".", slash + 1);
  if (slash <= 0 || dot === -1 || dot === lhs.length - 1) {
    return fail(raw, "expected <folder>/<file>.<field path>, e.g. skills/fireball.stats.area");
  }
  let value: unknown;
  try {
    value = JSON.parse(rhs);
  } catch {
    return fail(raw, `value ${rhs} is not JSON (strings need quotes: "text")`);
  }
  return { raw, file: `${lhs.slice(0, dot)}.json`, path: lhs.slice(dot + 1).split("."), value };
}

function isContainer(v: unknown): v is object {
  return typeof v === "object" && v !== null;
}

function childOf(node: unknown, key: string): unknown {
  if (!isContainer(node) || !Object.hasOwn(node, key)) return undefined;
  return Reflect.get(node, key);
}

/** Applies overrides to copies of the parsed files; the input map is never mutated. */
export function applyOverrides(
  files: Readonly<Record<string, unknown>>,
  overrides: readonly Override[],
): { files: Record<string, unknown>; errors: ContentError[] } {
  const out: Record<string, unknown> = { ...files };
  const errors: ContentError[] = [];
  for (const o of overrides) {
    const where = o.path.join(".");
    if (!Object.hasOwn(out, o.file)) {
      errors.push({ file: o.file, path: where, message: `override ${o.raw}: no such file` });
      continue;
    }
    const doc = structuredClone(out[o.file]);
    let parent: unknown = doc;
    for (const key of o.path.slice(0, -1)) parent = childOf(parent, key);
    if (!isContainer(parent)) {
      errors.push({ file: o.file, path: where, message: `override ${o.raw}: path does not exist` });
      continue;
    }
    Reflect.set(parent, o.path[o.path.length - 1], o.value);
    out[o.file] = doc;
  }
  return { files: out, errors };
}
