import { GENERATED_LOOK_KEYS } from "@/content/kinds";
import type { loadContent as LoadContent } from "@/content/load";
import type { Content } from "@/content/types";

/**
 * The app reads content only through this module. Vite walks a changed module's importers
 * looking for one that accepts it; if main.ts imported the loader itself, every content save
 * would reach main.ts, which accepts nothing, and reload the page.
 */
export { loadContent } from "@/content/load";

export type ContentChange = "none" | "look" | "sim" | "assets";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** What a valid reload changed; new assets (a generated manifest: atlas, sounds) need a page reload. */
export function classifyChange(prev: Content, next: Content): ContentChange {
  const look = (c: Content) => c.look as Readonly<Record<string, unknown>>;
  if (GENERATED_LOOK_KEYS.some((key) => !same(look(prev)[key], look(next)[key]))) return "assets";
  if (!same(prev.sim, next.sim)) return "sim";
  if (!same(prev.look, next.look)) return "look";
  return "none";
}

/**
 * Calls back with the reloaded loader whenever a content file changes under `pnpm dev`.
 * The loader globs content/ as raw text, so any content edit invalidates it and lands here
 * instead of Vite's JSON overlay or a full page reload.
 *
 * The `import.meta.hot.accept(dep, cb)` call below must stay written out in full at its call
 * site: Vite finds HMR boundaries by scanning each module's own source text for that literal
 * pattern, not by tracing values at runtime, so `const hot = import.meta.hot; hot.accept(...)`
 * is invisible to it and every content save falls back to a full page reload (confirmed against
 * the real dev server).
 */
export function onContentReload(cb: (load: typeof LoadContent) => void): void {
  if (import.meta.hot === undefined) return;
  import.meta.hot.accept("/src/content/load.ts", (mod) => {
    if (mod === undefined) throw new Error("src/content/load.ts failed to reload");
    // A module namespace is untyped; this is the loader module's own export, not content.
    cb(mod.loadContent as typeof LoadContent);
  });
}
