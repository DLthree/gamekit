/**
 * The browser side shared by the WebKit tools (`pnpm shot`, `pnpm film`, `pnpm screens`,
 * `pnpm perf`): the machine's browser lock, an own Vite server on TOOL_PORT (only ever one, since
 * it starts under the lock), WebKit, and pages that open the game at a device size.
 */
import { type Browser, devices, type Page, webkit } from "@playwright/test";
import { acquireBrowserLock } from "@scripts/browser-guard";
import { createServer } from "vite";

const TOOL_PORT = 5283;

export const DEVICES = ["desktop", "deck", "phone", "phone-landscape"] as const;
export type Device = (typeof DEVICES)[number];

/**
 * Takes the browser lock, serves the game and launches WebKit, runs `fn` with the browser and
 * the server's base URL, then closes both.
 */
export async function withGameBrowser<T>(
  what: string,
  fn: (browser: Browser, base: string) => Promise<T>,
): Promise<T> {
  acquireBrowserLock(what);
  const server = await createServer({
    server: { host: "127.0.0.1", port: TOOL_PORT, strictPort: true },
  });
  await server.listen();
  let browser: Browser | null = null;
  try {
    browser = await webkit.launch();
    return await fn(browser, `http://127.0.0.1:${TOOL_PORT}`);
  } finally {
    await browser?.close();
    await server.close();
  }
}

/**
 * A scenario query made reproducible for a tool: telemetry off and seed 7 unless the query says
 * otherwise (dev boots with telemetry on and a random seed), each of a tool's `--o` content
 * overrides added as an `o=` (src/content/overrides.ts), then manual=1&agent=1 so the tool steps
 * the sim itself and reads its events.
 */
export function toolQuery(query: string, overrides: readonly string[] = []): string {
  const params = new URLSearchParams(query);
  if (!params.has("telemetry")) params.set("telemetry", "0");
  if (!params.has("seed")) params.set("seed", "7");
  for (const o of overrides) params.append("o", o);
  params.set("manual", "1");
  params.set("agent", "1");
  return params.toString();
}

/** The viewport of `device`: Desktop Safari (the release target), a Steam Deck, an iPhone 14. */
function contextFor(device: Device) {
  const desk = device === "desktop" || device === "deck";
  const preset = devices[desk ? "Desktop Safari" : "iPhone 14"];
  const viewport =
    device === "deck"
      ? { width: 1280, height: 800 }
      : device === "phone-landscape"
        ? { width: preset.viewport.height, height: preset.viewport.width }
        : preset.viewport;
  return { ...preset, viewport };
}

/** A page at `device` size, collecting page errors into `errors`. */
export async function openPage(
  browser: Browser,
  device: Device,
): Promise<{ page: Page; errors: string[] }> {
  const page = await (await browser.newContext(contextFor(device))).newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { page, errors };
}

/** Waits two animation frames, so the canvas shows the last stepped tick. */
export function settleFrame(page: Page): Promise<unknown> {
  return page.evaluate(
    () =>
      new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(null)))),
  );
}

/** The `--o <kind>/<id>.<path>=<json>` option every tool takes (repeatable), as parseArgs reads it. */
export const OVERRIDE_OPTION: { type: "string"; multiple: true; default: string[] } = {
  type: "string",
  multiple: true,
  default: [],
};

/** A file-name-safe form of a query. */
export function queryName(query: string): string {
  return query.replace(/[^a-z0-9=]+/gi, "_");
}
