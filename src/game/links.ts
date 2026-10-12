/** The game's addresses that the kit's tools open (pnpm perf, pnpm phone, pnpm shot, e2e specs). */

/** The first cell: the wizard's first build against the first threat. */
export const CELL = "char=wizard&build=1&threat=1";

/** pnpm perf's fixed run: the heaviest cell, played by the kite bot on a fixed seed. */
export const PERF_QUERY = "char=wizard&build=3&threat=3&seed=7&bot=kite";

/** pnpm phone's links: the grid, the diagonal (balanced), one cell above it and one below. */
export const PHONE_QUERIES = [
  "",
  "char=wizard&build=1&threat=1",
  "char=wizard&build=2&threat=2",
  "char=wizard&build=3&threat=3",
  "char=wizard&build=3&threat=1",
  "char=wizard&build=1&threat=3",
];
