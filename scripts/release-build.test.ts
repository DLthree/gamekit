import { fileURLToPath } from "node:url";
import { build, type Rolldown } from "vite";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));

/** `pnpm build`'s bundle, in memory: every emitted chunk and asset by file name. */
async function releaseFiles(): Promise<Map<string, string>> {
  const out = await build({
    root,
    mode: "release",
    logLevel: "silent",
    build: { write: false },
  });
  const outputs = (Array.isArray(out) ? out : [out]) as Rolldown.RolldownOutput[];
  const files = new Map<string, string>();
  for (const o of outputs)
    for (const f of o.output)
      files.set(
        f.fileName,
        f.type === "chunk"
          ? f.code
          : typeof f.source === "string"
            ? f.source
            : new TextDecoder().decode(f.source),
      );
  return files;
}

describe("the release build (pnpm build)", () => {
  it("ships no dev surface and loads from any path", { timeout: 120_000 }, async () => {
    const files = await releaseFiles();
    const js = [...files].filter(([name]) => name.endsWith(".js"));
    expect(js.length).toBeGreaterThan(0);
    // The dev server's telemetry endpoint, the stage benches, the agent handle: each listed with the files holding it (the bundle is too big to print).
    const holding = (text: string) => js.filter(([, code]) => code.includes(text)).map(([n]) => n);
    expect({
      telemetry: holding("/__telemetry"),
      stages: holding("/content/stages/"),
      handle: holding("__game"),
    }).toEqual({ telemetry: [], stages: [], handle: [] });
    // The URL's refusal is in, so a dev address names what this build lacks.
    expect(holding("not in this build").length).toBeGreaterThan(0);
    const html = files.get("index.html");
    if (html === undefined) throw new Error("no index.html in the release build");
    expect(html).not.toMatch(/(src|href)="\//);
    for (const [name, css] of files)
      if (name.endsWith(".css")) expect(css, name).not.toMatch(/url\(["']?\//);
  });
});
