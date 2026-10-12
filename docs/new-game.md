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

First map the game's mechanics onto docs/layout.md "What the sim expresses": what is content,
what is game code at a seam, and what (if anything) is a kit edit.

- Kit kinds (`src/content/kinds.ts`: sounds) stay. A real-time game keeps the real-time kinds
  (`src/realtime/content/kinds.ts`: skills, modifiers, characters, enemies, rules, look, stages…)
  spread into its `GAME_KINDS` and changes their files in `content/`; a turn-based one drops them.
- Game kinds: replace `src/game/content.ts` `GAME_KINDS` (`{ sim, look }`) and `src/game/schema/*`
  with the new game's folders (the example has `builds/`, `threats/`, `deeds/`).
- Real-time names: `src/game/vocab.ts` `TAGS`, `DAMAGE_TYPES`, `ROLES`, `OUTCOMES` (how a wave
  ends). Then `src/game/test-files.ts` `TEST_NAMES`: which of them the real-time tests' content
  uses (3 tags, 1–2 damage types, 2 roles). The core tests read your `content/` and need nothing.
- Cross-file rules: `src/game/check.ts` (`checkGame`, `checkGameResolved`).
- `pnpm content:schema` rewrites `content/schema/`.

Gate: `pnpm content:check`, then `pnpm check`.

## 3. The seam modules

Replace each `src/game/` module the kit imports, keeping its exports (types may change shape).
Every game provides the core ones; a real-time game also the realtime ones (docs/layout.md, "The
seam"):

| Module | Layer | Must export |
|--------|-------|-------------|
| `content.ts`, `check.ts` | core | `GAME_KINDS`; `checkGame`, `checkGameResolved`, `checkGameFiles` (step 2) |
| `handle.ts` | core | `GameHandle`: the game's part of `window.__game` (its `flow()`, `state()`, and what specs drive); `main.ts` adds `act(action)`, the scripted action tools replay (a move, or a command for N frames), and runs everything that moves in `FrameClock` frames (`src/core/frames.ts`) |
| `telemetry.ts` | core | `RunReport`, `GameRecord`, `runLines`, `sessionLines` (a run's record and summary) |
| `record.ts` | core | `replayQuery` (a run record → the address that replays it) |
| `links.ts` | core | `PHONE_QUERIES`, `SCREENS` (realtime also `PERF_QUERY`), and the ids specs name |
| `sweep.ts`, `switches.ts`, `deeds.ts` | core | step 4; `SWITCHES` (may be `{}`); `deedList` (step 8) |
| `scenario.ts` | realtime | `Scenario` (one run's setup) |
| `setup.ts` | realtime | `worldFor(scenario, content)` → kit `createWorld` |
| `report.ts` | realtime | `WaveReport`, `recordEvents` |
| `wave/director.ts`, `wave/tick.ts` | realtime | `WaveState`, `tickWave` (step phase 9: spawns, win/lose) |
| `bots.ts` | realtime | `BOTS`, `BOT_IDS` (`ticks` plays them; any game passes its bot ids to `parseOptions`) |
| `headless.ts` | realtime | `worldForQuery`, `tickLine` (what `pnpm ticks` prints) |
| `behaviors.ts` | realtime | `BEHAVIORS` (may be `{}`): enemy movement beyond chase and keepDistance |
| `test-files.ts` | realtime | `heroBuild`, `GAME_TEST_FILES` (a quiet wave: no end in its first 10 s while the player lives, an end within 10 min), `TEST_NAMES` |

A turn-based game deletes `src/realtime/`, `scripts/realtime/` and the realtime rows; `pnpm check`
then names every package.json script and import left pointing at them.

Then the rest of the game: `main.ts`, `wave-session.ts`, `ui/` screens, `ui/pad-keys.ts`,
(menus: `showPage` from `src/ui/page.ts` gives each a title, a body that scrolls in a short window
and a button row; `startPadNav` once in `main.ts` lets the pad reach every page it shows),
`index.html`, and `tests/e2e/*.spec.ts` (keep `fixtures.ts`; keep a `layout.spec.ts` that holds
each screen's boxes fixed across states). Specs and game tests take ids from `links.ts`; set those
first, then rewrite the specs that test the example's rules. Where a player presses something, a
spec presses it as one does: `mouseClick` (desktop) or `fingerTap` (a test tagged `@touch`), which
reach it by wheel or swipe and fail when it is covered or out of reach; one spec plays a run in a
short window (e.g. 1280×420). Anything that looks pressable is a `<button>`.

Gate: `pnpm check`, then `pnpm screens` and `pnpm shot "<CELL>"` look right, then `pnpm verify`.

## 4. Bot and sweep

- `src/game/bots.ts` `BOTS`: at least one bot that plays like a player (the example's is
  `kite-bot.ts`). Film it: `pnpm film "<query>&bot=<id>" --frames 120 --count 12 --every 30`.
- `src/game/sweep.ts`: `SweepRow`, `sweepRuns` (the run ids), `playRun` (one run headless),
  `sweepTable` (the summary).

Gate: `pnpm sweep --seeds 5` prints a table; the film shows the bot doing what a player would.

## 5. Art style, then sprites

1. Concepts without a preset (`uv run scripts/qwen_image.py "..." -o ... --aspect 16:9`); pick
   the look.
2. Rewrite `assets/style/presets.json` (`sprite`, `fx`, `concept`) for the new style: the style
   written in words (text-to-image, no references), or a *non-subject* swatch (a texture or
   pattern, never a creature) as `assets/style/anchor.png`. Image-to-image edits its reference, so
   a subject anchor appears in every image (the `art` skill). Generate one test image per preset
   and check it before any batch.
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
