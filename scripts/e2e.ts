/**
 * pnpm e2e [playwright args] — the only way to run the e2e suite. Takes the browser lock and
 * checks memory (browser-guard.ts), then runs `playwright test`; playwright.config.ts refuses to
 * load without this wrapper's env mark.
 */
import { spawn } from "node:child_process";
import { acquireBrowserLock, checkE2eArgs } from "@scripts/browser-guard";

const args = process.argv.slice(2);
checkE2eArgs(args);
acquireBrowserLock(`pnpm e2e ${args.join(" ")}`.trim());
const child = spawn("playwright", ["test", ...args], {
  stdio: "inherit",
  env: { ...process.env, INCPOE_E2E_GUARD: "1" },
});
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => child.kill(sig));
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal === null ? 1 : 128);
});
