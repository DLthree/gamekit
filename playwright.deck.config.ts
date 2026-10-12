import { defineConfig } from "@playwright/test";
import { checkE2eArgs, E2E_MAX_WORKERS } from "@scripts/browser-guard";

// The Steam Deck check (tests/deck): on demand only, never part of `pnpm check`, `pnpm verify`
// or the hooks. `pnpm deck:check` runs it through `pnpm e2e`, which takes the browser lock and
// sets the mark.
if (process.env.GAMEKIT_E2E_GUARD !== "1")
  throw new Error("run through `pnpm deck:check`, not `playwright test` directly");
checkE2eArgs(process.argv);

const PORT = 5284;

export default defineConfig({
  testDir: "tests/deck",
  forbidOnly: true,
  workers: E2E_MAX_WORKERS,
  fullyParallel: true,
  reporter: "list",
  timeout: 120_000,
  globalSetup: "./tests/deck/setup.ts",
  globalTeardown: "./tests/deck/teardown.ts",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // A Steam Deck's screen, at its own pixel density.
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    trace: { mode: "retain-on-failure", screenshots: false },
  },
  projects: [
    {
      // The Deck runs the desktop shell: Chromium, audio allowed without a gesture
      // (desktop/main.ts autoplayPolicy).
      name: "deck",
      use: {
        browserName: "chromium",
        launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
      },
    },
  ],
  webServer: {
    command: `vite --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { GAMEKIT_TELEMETRY_DIR: ".e2e/deck-telemetry" },
  },
});
