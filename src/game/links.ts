/**
 * The game's addresses and ids that the kit's tools, e2e specs and game tests open. Specs and
 * tests take ids from here, never as literals, so a new game edits this file and they follow.
 */

/** The playable character. */
export const HERO = "wizard";
/** The hero's manual (cast slot) skill in every build tier. */
export const CAST_SKILL = "fireball";
/** The bot that plays like a player (src/game/bots.ts). */
export const BOT = "kite";
/** A feature switch (src/game/switches.ts). */
export const SWITCH = "throwers";
/** A bench (content/stages/). */
export const STAGE = "dragon";

/** The first cell: the hero's first build against the first threat. */
export const CELL = `char=${HERO}&build=1&threat=1`;

/** pnpm perf's fixed run: the heaviest cell (every switch on), played by the bot on a fixed seed. */
export const PERF_QUERY = `char=${HERO}&build=3&threat=3&seed=7&bot=${BOT}&on=${SWITCH}`;

/** pnpm phone's links: the grid, the diagonal (balanced), one cell above it and one below. */
export const PHONE_QUERIES = [
  "",
  `char=${HERO}&build=1&threat=1`,
  `char=${HERO}&build=2&threat=2`,
  `char=${HERO}&build=3&threat=3`,
  `char=${HERO}&build=3&threat=1`,
  `char=${HERO}&build=1&threat=3`,
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
      window.__game?.frames(120);
      window.__game?.pause();
    },
  },
  result: {
    query: `${CELL}&bot=${BOT}`,
    screen: "result",
    act: () => {
      window.__game?.act({ frames: 20_000 });
    },
  },
  error: { query: `char=${HERO}&build=9&threat=1`, screen: "error" },
};
