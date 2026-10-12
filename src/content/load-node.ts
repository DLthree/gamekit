import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { buildContent, type CompileResult } from "@/content/compile";

/** The repo's content/ folder, for scripts and the shipped-content tests. */
export const REPO_CONTENT_DIR = fileURLToPath(new URL("../../content", import.meta.url));

/** Every content JSON file under `dir` (not the generated JSON Schemas), keyed by relative path. */
export function readContentTexts(dir: string): Record<string, string> {
  const texts: Record<string, string> = {};
  const entries = readdirSync(dir, { recursive: true, encoding: "utf8" }).sort();
  for (const entry of entries) {
    const file = entry.split(sep).join("/");
    if (!file.endsWith(".json") || file.startsWith("schema/")) continue;
    texts[file] = readFileSync(join(dir, entry), "utf8");
  }
  return texts;
}

export function loadContentDir(dir: string, overrides: readonly string[]): CompileResult {
  return buildContent(readContentTexts(dir), overrides);
}
