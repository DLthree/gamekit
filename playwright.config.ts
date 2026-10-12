import { defineConfig, devices } from "@playwright/test";
import { checkE2eArgs, E2E_MAX_WORKERS } from "@scripts/browser-guard";

// Every worker is a WebKit browser running the game; unguarded parallel runs froze the dev
// machine (scripts/browser-guard.ts). `pnpm e2e` takes the browser lock and sets the mark.
if (process.env.GAMEKIT_E2E_GUARD !== "1")
  throw new Error("run e2e through `pnpm e2e` (scripts/e2e.ts), not `playwright test` directly");
checkE2eArgs(process.argv);

const PORT = 5281;
const TOUCH_SPECS = ["controls.spec.ts", "sound.spec.ts"];

export default defineConfig({
  testDir: "tests/e2e",
  forbidOnly: true,
  workers: E2E_MAX_WORKERS,
  reporter: "list",
  timeout: 60_000,
  // No trace screenshots: WebKit's screencast leaks kernel memory on macOS until reboot.
  // Actions and DOM snapshots are kept.
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: { mode: "retain-on-failure", screenshots: false },
  },
  projects: [
    // Desktop is the release target; only the touch and iOS-audio specs need the phone.
    {
      name: "desktop",
      use: devices["Desktop Safari"],
      testIgnore: TOUCH_SPECS,
      grepInvert: /@content/,
      fullyParallel: true,
    },
    { name: "iphone", use: devices["iPhone 14"], testMatch: TOUCH_SPECS, fullyParallel: true },
    // Content specs edit files the server watches, so they run alone, after the rest.
    {
      name: "content",
      use: devices["Desktop Safari"],
      grep: /@content/,
      fullyParallel: false,
      dependencies: ["desktop", "iphone"],
    },
  ],
  webServer: {
    command: `mkdir -p .e2e && rsync -a --delete content/ .e2e/content/ && vite --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { GAMEKIT_CONTENT_DIR: ".e2e/content", GAMEKIT_TELEMETRY_DIR: ".e2e/telemetry" },
  },
});
