import { defineConfig } from "@playwright/test";
import { checkE2eArgs } from "@scripts/browser-guard";

// The desktop shell's smoke test (tests/desktop): one Electron app at a time, on dist/ and
// desktop/dist/. `pnpm desktop:smoke` builds both, then runs this through `pnpm e2e`, which takes
// the browser lock and sets the mark.
if (process.env.GAMEKIT_E2E_GUARD !== "1")
  throw new Error("run through `pnpm desktop:smoke`, not `playwright test` directly");
checkE2eArgs(process.argv);

export default defineConfig({
  testDir: "tests/desktop",
  forbidOnly: true,
  workers: 1,
  reporter: "list",
  timeout: 120_000,
  use: { trace: { mode: "retain-on-failure", screenshots: false } },
});
