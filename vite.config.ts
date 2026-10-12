import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Connect, Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { PORTS } from "./scripts/ports.ts";

const src = fileURLToPath(new URL("./src", import.meta.url));
const scripts = fileURLToPath(new URL("./scripts", import.meta.url));
const desktop = fileURLToPath(new URL("./desktop", import.meta.url));

const root = fileURLToPath(new URL(".", import.meta.url));
/** The content folder the browser loads: the repo's, or the e2e server's scratch copy. */
const contentDir = resolve(root, process.env.GAMEKIT_CONTENT_DIR ?? "content");
/**
 * The tree being built or served (this config's own checkout: `pnpm phone` builds in `.phone/`,
 * so it reports the ref the phone runs). Throws outside a git checkout (fail fast).
 */
const commit = execFileSync("git", ["describe", "--always", "--dirty", "--exclude=*"], {
  cwd: root,
})
  .toString()
  .trim();

/** POST /__telemetry: a JSON array of records, appended one per line with the server's receipt time. */
function telemetry(dir: string): Plugin {
  const handle: Connect.NextHandleFunction = (req, res, next) => {
    if (req.url !== "/__telemetry" || req.method !== "POST") {
      next();
      return;
    }
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      body += chunk;
    });
    req.on("end", () => {
      const receivedAt = new Date().toISOString();
      let records: unknown;
      try {
        records = JSON.parse(body);
      } catch (e) {
        res.statusCode = 400;
        res.end(`telemetry body is not JSON: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
      if (!Array.isArray(records)) {
        res.statusCode = 400;
        res.end("telemetry body must be a JSON array");
        return;
      }
      if (records.length > 0) {
        mkdirSync(dir, { recursive: true });
        const lines = records.map((r) => JSON.stringify({ ...r, receivedAt })).join("\n");
        appendFileSync(join(dir, `${receivedAt.slice(0, 10)}.jsonl`), `${lines}\n`);
      }
      res.statusCode = 204;
      res.end();
    });
  };
  return {
    name: "gamekit-telemetry",
    configureServer: (server) => {
      server.middlewares.use(handle);
    },
    configurePreviewServer: (server) => {
      server.middlewares.use(handle);
    },
  };
}

/**
 * `vite build --mode release` (pnpm build) is the shipped game: no dev surface (the URL refuses
 * the dev parameters, telemetry never POSTs, no stages, no window.__game, the error panel's raw
 * lines sit behind Details) and a relative base, so dist/ runs from any path or the desktop
 * shell's app:// protocol. Every other mode (pnpm dev, the phone build, vitest) keeps the tools.
 */
export default defineConfig(({ mode }) => {
  const release = mode === "release";
  return {
    base: release ? "./" : "/",
    define: { __COMMIT__: JSON.stringify(commit), __RELEASE__: JSON.stringify(release) },
    resolve: {
      alias: [
        { find: "@content", replacement: contentDir },
        { find: "@scripts", replacement: scripts },
        { find: "@desktop", replacement: desktop },
        { find: "@", replacement: src },
      ],
    },
    server: { host: "0.0.0.0", port: PORTS.dev, strictPort: true },
    preview: { host: "0.0.0.0", port: PORTS.preview, strictPort: true },
    // The app with Phaser is one ~1.7 MB chunk (~430 kB gzipped) and the game can't start without
    // Phaser, so splitting it buys nothing; the limit sits just above it to catch real growth.
    build: { chunkSizeWarningLimit: 1800 },
    plugins: release
      ? []
      : [telemetry(resolve(root, process.env.GAMEKIT_TELEMETRY_DIR ?? "telemetry"))],
    test: { include: ["src/**/*.test.ts", "scripts/**/*.test.ts", "desktop/**/*.test.ts"] },
  };
});
