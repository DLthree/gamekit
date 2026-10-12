import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * package.json's scripts point only at files and scripts that exist: deleting a tool (or the
 * realtime layer) without its script fails here instead of at the next `pnpm <script>`.
 */
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const scripts: Record<string, string> = JSON.parse(
  readFileSync(join(ROOT, "package.json"), "utf8"),
).scripts;

/** A command line's words that name a file: a path with a source or config extension. */
const FILE = /^\.?\/?[\w./-]+\.(?:ts|cts|mts|js|cjs|mjs|sh|py|json)$/;

function words(command: string): string[] {
  return command.split(/[\s'"{}();|&]+/).filter((w) => w !== "");
}

describe("package.json scripts", () => {
  it("find the words that name files and scripts", () => {
    expect(
      words("node --import ./scripts/a.ts scripts/b.ts && pnpm c").filter((w) => FILE.test(w)),
    ).toEqual(["./scripts/a.ts", "scripts/b.ts"]);
  });

  it("name only files that exist", () => {
    const missing = Object.entries(scripts).flatMap(([name, command]) =>
      words(command)
        .filter((w) => FILE.test(w) && !existsSync(join(ROOT, w)))
        .map((w) => `${name}: ${w}`),
    );
    expect(missing).toEqual([]);
  });

  it("run only scripts that exist (pnpm <script>)", () => {
    const missing = Object.entries(scripts).flatMap(([name, command]) =>
      [...command.matchAll(/\bpnpm ([a-z][\w:-]*)/g)]
        .map(([, script]) => script)
        .filter((script) => !Object.hasOwn(scripts, script))
        .map((script) => `${name}: pnpm ${script}`),
    );
    expect(missing).toEqual([]);
  });
});
