/** The game's addresses that the kit's tools open (pnpm perf, pnpm phone, pnpm shot, e2e specs). */

/** The first cell: the wizard's first build against the first threat. */
export const CELL = "char=wizard&build=1&threat=1";

/** pnpm perf's fixed run: the heaviest cell (every switch on), played by the kite bot on a fixed seed. */
export const PERF_QUERY = "char=wizard&build=3&threat=3&seed=7&bot=kite&on=throwers";

/** pnpm phone's links: the grid, the diagonal (balanced), one cell above it and one below. */
export const PHONE_QUERIES = [
  "",
  "char=wizard&build=1&threat=1",
  "char=wizard&build=2&threat=2",
  "char=wizard&build=3&threat=3",
  "char=wizard&build=3&threat=1",
  "char=wizard&build=1&threat=3",
];

/**
 * pnpm screens' pages: each opens at `query` (made reproducible: seed 7, manual=1), runs `act`
 * in the page if given, and is shot once the flow is on `screen`.
 */
export const SCREENS: Record<
  string,
  { query: string; screen: "picker" | "wave" | "result" | "error"; act?: () => void }
> = {
  picker: { query: "", screen: "picker" },
  pause: {
    query: CELL,
    screen: "wave",
    act: () => {
      window.__game?.step(120);
      window.__game?.pause();
    },
  },
  result: {
    query: `${CELL}&bot=kite`,
    screen: "result",
    act: () => {
      window.__game?.step(20_000);
    },
  },
  error: { query: "char=wizard&build=9&threat=1", screen: "error" },
};
