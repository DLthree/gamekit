# Making a new game

Do the steps in order. Each ends on a gate; don't start the next step while it is red. The example
keeps running until step 9, so the tools work on it while you replace it piece by piece.
docs/layout.md says which files are kit (keep) and game (replace).

## 1. Rename and ports

- Name: `package.json` `name`, `index.html` `<title>`, `public/manifest.webmanifest` (`name`,
  `short_name`; its `start_url` follows `CELL` in step 3, a test checks it),
  `ship/config.json` (`productName`, `appId`, `executableName`), `ship/media.json` `title`, the
  expectation in `scripts/desktop-build.test.ts`, the top of README.md.
- Ports, if another gamekit game (this template's checkout counts) runs on this machine: `BASE`
  in `scripts/ports.ts` (every config and script reads it; all are `strictPort`), and the base in
  CLAUDE.md's Ports line.

Gate: `pnpm verify`.

## 2. Content kinds and schemas

- Kit kinds (`src/content/kinds.ts`: skills, modifiers, characters, enemies, rules, look, stages…)
  stay; change their files in `content/`.
- Game kinds: replace `src/game/content.ts` `GAME_KINDS` and `src/game/schema/*` with the new
  game's folders (the example has `builds/`, `threats/`, `deeds/`).
- Names: `src/game/vocab.ts` `TAGS`, `DAMAGE_TYPES`, `ROLES`, `OUTCOMES` (how a wave ends). Then `src/game/test-files.ts`
  `TEST_NAMES`: which of them the kit's test content uses (3 tags, 1–2 damage types, 2 roles).
- Cross-file rules: `src/game/check.ts` (`checkGame`, `checkGameResolved`).
- `pnpm content:schema` rewrites `content/schema/`.

Gate: `pnpm content:check`, then `pnpm check`.

## 3. The seam modules

Replace each `src/game/` module the kit imports, keeping its exports (types may change shape):

| Module | Must export |
|--------|-------------|
| `scenario.ts` | `Scenario` (one run's setup) |
| `setup.ts` | `worldFor(scenario, content)` → kit `createWorld` |
| `report.ts` | `WaveReport`, `recordEvents` |
| `wave/director.ts`, `wave/tick.ts` | `WaveState`, `tickWave` (step phase 9: spawns, win/lose) |
| `flow.ts` | `Flow` (screen state machine) |
| `url.ts` | `reproUrl` (and the game's own URL parsing) |
| `links.ts` | `CELL`, `PERF_QUERY`, `PHONE_QUERIES`, `SCREENS`, and the ids specs name (`HERO`, `BOT`…) |
| `headless.ts` | `worldForQuery`, `tickLine` (what `pnpm ticks` prints) |
| `record.ts` | `recordOf`, `replayQuery` |
| `switches.ts` | `SWITCHES` (may be `{}`) |
| `test-files.ts` | `heroBuild`, `GAME_TEST_FILES` (a quiet wave: no end in its first 10 s while the player lives, an end within 10 min), `TEST_NAMES` |

Then the rest of the game: `main.ts`, `wave-session.ts`, `ui/` screens, `ui/pad-keys.ts`,
`index.html`, and `tests/e2e/*.spec.ts` (keep `fixtures.ts`; keep a `layout.spec.ts` that holds
each screen's boxes fixed across states). Specs and game tests take ids from `links.ts`; set those
first, then rewrite the specs that test the example's rules.

Gate: `pnpm check`, then `pnpm screens` and `pnpm shot "<CELL>"` look right, then `pnpm verify`.

## 4. Bot and sweep

- `src/game/bots.ts` `BOTS`: at least one bot that plays like a player (the example's is
  `kite-bot.ts`). Film it: `pnpm film "<query>&bot=<id>" --at 2 --frames 12 --every 500`.
- `src/game/sweep.ts`: `SweepRow`, `sweepRuns` (the run ids), `playRun` (one run headless),
  `sweepTable` (the summary).

Gate: `pnpm sweep --seeds 5` prints a table; the film shows the bot doing what a player would.

## 5. Art style, then sprites

1. Concepts without a preset (`uv run scripts/qwen_image.py "..." -o ... --aspect 16:9`); pick
   one as `assets/style/anchor.png`.
2. Rewrite `assets/style/presets.json` (`sprite`, `fx`, `concept`) for the new style.
3. Generate, compare and install each creature and effect (the `art` skill), with its
   `content/look/creatures.json` and `content/look/fx.json` entries.
4. `uv run scripts/icon.py assets/creatures/<hero>.png` for `ship/icon.png`.

Gate: `pnpm content:check` (every frame in the atlas); `pnpm shot` of a stage with the new art.

## 6. Sounds

Replace the `fetch`/`kenney`/`oneshot` lines in `scripts/build-sounds.sh`, the rows in
`public/sounds/LICENSE.md` (CC0 only) and the tunings in `content/look/sounds.json` (the `audio`
skill).

Gate: `pnpm sounds`, `pnpm content:check`, `pnpm sound-sheet` sounds right.

## 7. Stages

Benches in `content/stages/<id>.json` for the fights you tune often (one per boss, one per
elite). Open each with `?stage=<id>&dev=1`.

Gate: `pnpm content:check`; `pnpm shot "stage=<id>"` for each.

## 8. Deeds and ship config

- Deeds (achievements): `content/deeds/`, `src/game/deeds.ts` `deedList`.
- `ship/config.json`: Steam App and depot IDs and the itch target once they exist (TODO until then).
- `ship/media.json`: store screenshots and trailer beats.

Gate: `pnpm steam:achievements`; `pnpm desktop:smoke`; `pnpm store-media shots`.

## 9. Delete the example's leftovers

`rg -i -w 'wizard|snail|rabbit|bat|lion|dragon|thrower|fireball'` across `src/`, `content/`,
`assets/`, `public/`, `tests/`, `scripts/`, `ship/` and docs. Delete what remains; kit code must
name none of it. Rewrite `tests/deck/walk.spec.ts` for the new screens.

Gate: `pnpm verify`, `pnpm deck:check`, then a phone build (`pnpm phone <sha>`) for the director.
