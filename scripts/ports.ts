/**
 * Every server port the repo opens, from one base. Configs and scripts read these; change BASE
 * when another gamekit game runs on this machine (every server is `strictPort`).
 */
const BASE = 5280;

export const PORTS = {
  /** pnpm dev, with hot content reload. */
  dev: BASE,
  /** pnpm e2e's own dev server. */
  e2e: BASE + 1,
  /** pnpm phone's pinned build. */
  phone: BASE + 2,
  /** The WebKit tools' server: shot, film, screens, perf, store-media. */
  tools: BASE + 3,
  /** pnpm deck:check's server. */
  deck: BASE + 4,
  /** pnpm preview, the release build. */
  preview: BASE + 9,
} as const;
