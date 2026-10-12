/**
 * pnpm deck:check [playwright args]
 *
 * The Steam Deck check, on demand only (never in `pnpm check` or `pnpm verify`): runs tests/deck
 * through `pnpm e2e` (the browser lock) in Chromium at 1280×800. A pad-only walk of every screen
 * (what the D-pad can't reach, a control A can't press, any real mouse/keyboard/touch event),
 * every text's size (a capital under 9 px fails, under 12 warns), mouse and keyboard words, and a
 * Deck-size shot of each screen. Writes shots/deck-check/report.{json,md} and shots/.
 * `pnpm shot "<query>" --deck` is one Deck-size frame of a fight.
 */
import { spawn } from "node:child_process";
import { parseArgs } from "node:util";

const USAGE = "usage: pnpm deck:check [--grep <test>] [playwright args]";

const fail = (why: string): never => {
  console.error(`${why}\n${USAGE}`);
  process.exit(1);
};

const args = process.argv.slice(2);
// Playwright's own flags pass through; only --config is this script's to set.
const { values } = parseArgs({ args, strict: false, options: { config: { type: "string" } } });
if (values.config !== undefined)
  fail("--config is the Deck check's own (playwright.deck.config.ts)");

const child = spawn(
  process.execPath,
  [
    "--import",
    "./scripts/node-alias.ts",
    "scripts/e2e.ts",
    "--config",
    "playwright.deck.config.ts",
    ...args,
  ],
  { stdio: "inherit" },
);
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => child.kill(sig));
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal === null ? 1 : 128);
});
