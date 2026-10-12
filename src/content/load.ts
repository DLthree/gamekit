import { buildContent, type CompileResult } from "@/content/compile";

const RAW = import.meta.glob<string>("@content/**/*.json", {
  query: "?raw",
  import: "default",
  eager: true,
});
const MARK = "/content/";

/** Every content file as text, keyed by path relative to content/ (generated JSON Schemas excluded). */
export function contentTexts(): Record<string, string> {
  const texts: Record<string, string> = {};
  for (const [key, text] of Object.entries(RAW)) {
    const at = key.lastIndexOf(MARK);
    if (at === -1) throw new Error(`content glob key ${key} has no ${MARK}`);
    const file = key.slice(at + MARK.length);
    if (!file.startsWith("schema/")) texts[file] = text;
  }
  return texts;
}

/** Raw texts, not Vite's JSON import: a half-saved file becomes a content error naming it. */
export function loadContent(overrides: readonly string[]): CompileResult {
  return buildContent(contentTexts(), overrides);
}
