/**
 * Lets Node run the repo's TypeScript natively (type stripping) with the tsconfig aliases:
 * "@/x" → src/x.ts, "@scripts/x" → scripts/x.ts, "@desktop/x" → desktop/x.ts. Use as `node --import ./scripts/node-alias.ts`.
 */
import { registerHooks } from "node:module";

const ALIASES: readonly (readonly [string, URL])[] = [
  ["@/", new URL("../src/", import.meta.url)],
  ["@scripts/", new URL("./", import.meta.url)],
  ["@desktop/", new URL("../desktop/", import.meta.url)],
  ["@deck/", new URL("../tests/deck/", import.meta.url)],
];

registerHooks({
  resolve(specifier, context, nextResolve) {
    for (const [prefix, base] of ALIASES) {
      if (specifier.startsWith(prefix)) {
        return nextResolve(new URL(`${specifier.slice(prefix.length)}.ts`, base).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});
