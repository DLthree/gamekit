# Layout: kit and game

Every file is **kit** (keep it when you make a new game) or **game** (the example: a wizard, a
3×3 build × threat picker, waves, an elite and a boss; replace it). Kit code never names game
content (wizard, fireball, snail…). Game behaviour reaches the kit through content data and the
seam modules listed below.

## Map

| Path | Side | What it does |
|------|------|--------------|
| `src/core/` | kit | Fixed-tick clock, seeded RNG, packed ids, vectors, spatial hash. |
| `src/content/` | kit | Content pipeline: load (browser and Node), overrides, compile, cross-file checks, errors. |
| `src/content/kinds.ts` | kit | The kit's content kinds (folder or file → schema); spreads in `GAME_KINDS`. |
| `src/content/stages.ts`, `schema/stage.ts` | kit | Stages: data-defined benches (`?stage=<id>&dev=1`) — schema, lookup, actor checks. |
| `src/sim/stage.ts` | kit | A running stage: actors placed on tick 1, respawned at their places; the player's life floors at 1. |
| `src/content/switches.ts` | kit | Feature switches: `on=a,b` parsing (unknown ids fail) and `switchOn`, which cuts the off systems from a frozen copy. |
| `src/content/schema/` | kit | Zod schemas for skills, modifiers, characters, enemies, rules, look, sounds, sprites, vocab. |
| `src/sim/` | kit | Headless sim: world, 10-phase step, actors, AI, skills, volumes, combat, stats, events, snapshot. |
| `src/present/` | kit | Sim events → what to draw and play: animation poses, fx pool and recipes, camera, telegraphs, sound plan. |
| `src/render/` | kit | Phaser boot, the world scene and its views, audio output and unlock. |
| `src/input/` | kit | Touch stick, skill button, keyboard, mouse, gamepad (`gamepad.ts`) → one `Command` per tick. |
| `src/app/` | kit | Real-time loop, content hot reload, aim view, telemetry setup, `platform.ts` (the save port: disk in the desktop shell, localStorage on the web; Steam's problem and deed unlocks). |
| `src/content/achievements.ts` | kit | Deeds → Steam achievements (`DEED_<ID>` API names) and their checks. |
| `src/agent/` | kit | `window.__game` handle, URL options, perf meter, telemetry client, run record (`record.ts`). |
| `src/ui/` | kit | Blocking error panel, base page styles (canvas, controls, `.panel`, `.act`), the action button (`button.ts`), gamepad menu navigation (`pad-nav.ts`) and pad shortcut hints (`pad-keys.ts`, from a game's `PadKeyMap`), and the dev terms no player may read (`vocabulary.ts`, checked by the game's `ui/vocabulary.test.ts`). |
| `desktop/` | kit | The Electron shell: `main.ts` (app:// on dist/, window mode, single instance), `preload.ts` (`window.gameDesktop`), atomic saves and telemetry files (`files.ts`), `ship.ts` (reads and checks `ship/config.json`), Steam (`steam*.ts`, the Steam flavour only). |
| `ship/` | game | What the game publishes as: `config.json` (product name, bundle id, Steam App and depot IDs, itch target; "TODO" placeholders until filled), `media.json` (the store media manifest), `icon.png`. |
| `src/test/` | kit | Test helpers: small synthetic content and worlds built through the game's setup; `vocab.ts` gives kit tests the game's names (`TEST_NAMES`), never the example's words. |
| `src/game/` | game | The example game's rules, screens and wiring (below). |
| `content/` | game | The example's JSON content (`content/stages/`: its benches); `content/schema/` is generated (`pnpm content:schema`). |
| `assets/` | game | Source art that `pnpm atlas` packs: `creatures/<id>.png` + sidecar, `fx/<id>/<n>.png` + `fx/<id>.json`. |
| `assets/style/` | game | The house style: `presets.json` (prompt wrappers for `qwen_image.py --preset`) and `anchor.png`, the style reference. |
| `public/atlas/`, `public/sounds/` | game | Packed atlas and sounds the game loads; `public/sounds/LICENSE.md` credits each sound (CC0 only). |
| `index.html` | game | The page: canvas, controls, and one element per screen. |
| `scripts/` | kit | `shot`, `film` (frame strips over sim time), `ticks` + `timeline.ts` (headless event ticks), `screens` (non-wave pages × devices), `sweep` + `sweep-run.ts`/`sweep-worker.ts` (parallel headless bot runs), `run-record` + `run-record-read.ts` (records → replay links), `perf` / `perf:check` (timings of `PERF_QUERY`), `phone`, `telemetry`, `content-check`, `e2e` + browser guard (one machine-wide lock, `~/.cache/browser-guard/lock`), and the art, audio and ship tools (README.md's command table; `.claude/skills/` for each family). |
| `scripts/build-sounds.sh` | kit + game | The loudness and loop functions are kit; the fetch and `oneshot` lines are the example's sounds, replaced per game. |
| `scripts/game-page.ts` | kit | The WebKit tools' shared setup: browser lock, own server on 5283, device pages, `toolQuery`. |
| `tests/e2e/fixtures.ts` | kit | Playwright fixtures: error capture, `open`, touch helpers, content edits. |
| `tests/desktop/` | kit | The desktop smoke test (`pnpm desktop:smoke`): saves across a relaunch, a corrupt save, the Steam build without Steam. |
| `tests/deck/pad.ts`, `setup.ts`, `teardown.ts` | kit | The Deck check's scripted pad, focus walker, text measure and report. |
| `tests/deck/walk.spec.ts` | game | The example's pad-only walk. |
| `tests/e2e/*.spec.ts` | game | Browser tests of the example game; `layout.spec.ts` holds each screen's element boxes equal across its states (stable layout), `gamepad.spec.ts` plays it with a scripted pad. |
| `README.md`, `CLAUDE.md`, `docs/`, `.claude/skills/` | kit | What the kit is, the agent's project instructions, this map, the new-game steps, one skill per tool family. |
| configs (`package.json`, `vite.config.ts`, `playwright.config.ts`, `playwright.desktop.config.ts`, `playwright.deck.config.ts`, `tsconfig.json`, `biome.json`, `.claude/`) | kit | Build, dev server, test runner, lint, agent hooks. |

## src/game

| File | What it does |
|------|--------------|
| `main.ts` | Entry: boots content and renderer, routes screens, installs the agent handle. |
| `wave-session.ts` | One running wave: world, loop, presentation, controls, per-frame draw. |
| `flow.ts` | Screen state machine (boot, picker, wave, result, error). |
| `url.ts` | The cell address (`char`, `build`, `threat`), `urlFor`, `reproUrl`. |
| `scenario.ts` | A run's setup (character × build tier × threat tier × seed, or a stage) and its checks. |
| `setup.ts` | `worldFor`: resolves the build and threat, then calls the kit's `createWorld`. |
| `loadout.ts` | Player skills from a build tier; enemy templates with threat mods; tunnelling check. |
| `wave/` | Threat timeline director, win/lose outcome, `tickWave` (step phase 9). |
| `report.ts` | The wave report built from sim events. |
| `content.ts`, `schema/` | Game content kinds (`builds/`, `threats/`, `deeds/`) and their schemas. |
| `deeds.ts` | Deeds: which a wave meets, the `deeds` save, `deedList` for the kit. |
| `check.ts`, `check-builds.ts` | Cross-file checks for builds, modifiers and threats. |
| `switches.ts` | The example's feature switches (`throwers`) and what each cuts when off. |
| `vocab.ts` | Name lists: tags, damage types, enemy roles, wave outcomes. |
| `bots.ts`, `kite-bot.ts` | Bots `?bot=` can name. |
| `picker.ts`, `ui/` | The 3×3 grid model and the HUD, pause, picker and result screens; `ui/pad-keys.ts` is their pad shortcuts. |
| `headless.ts` | A query's world without the renderer, and the events `pnpm ticks` lists. |
| `sweep.ts` | The run model `pnpm sweep` plays: run ids, one run with the kite bot, the summary table. |
| `record.ts` | The example's run record: its choices (the replay address's parameters) and `replayQuery`. |
| `links.ts` | Addresses the tools open (`CELL`, `PERF_QUERY`, `PHONE_QUERIES`, `SCREENS`) and the ids specs and tests name (`HERO`, `CAST_SKILL`, `BOT`, `SWITCH`, `STAGE`). |
| `test-files.ts` | The game's files in the kit's test content (`heroBuild`, `GAME_TEST_FILES`) and the names it uses (`TEST_NAMES`). |

## The seam

The kit imports only these game modules. A new game provides the same exports.

| Module | Used by | Exports |
|--------|---------|---------|
| `@/game/content` | content compile, kinds, types | `GAME_KINDS` |
| `@/game/check` | `content/check.ts` | `checkGame`, `checkGameResolved` |
| `@/game/vocab` | content schemas, stats, events | `TAGS`, `DAMAGE_TYPES`, `ROLES`, `OUTCOMES` |
| `@/game/scenario` | world, snapshot, telemetry | `Scenario` |
| `@/game/report` | step, world, handle, telemetry | `WaveReport`, `recordEvents` |
| `@/game/wave/director`, `@/game/wave/tick` | world, step | `WaveState`, `tickWave` |
| `@/game/flow` | agent handle | `Flow` |
| `@/game/bots` | URL options | `BOTS` |
| `@/game/switches` | `content/switches.ts` | `SWITCHES` |
| `@/game/url` | `scripts/telemetry-summary.ts` | `reproUrl` |
| `@/game/links` | `perf`, `phone`, `shot`, `film`, `ticks`, `screens`, e2e specs | `CELL`, `PERF_QUERY`, `PHONE_QUERIES`, `SCREENS` |
| `@/game/headless` | `scripts/timeline.ts` | `worldForQuery`, `tickLine` |
| `@/game/sweep` | `scripts/sweep*.ts` | `SweepRow`, `sweepRuns`, `playRun`, `sweepTable` |
| `@/game/record` | `scripts/run-record-read.ts` | `recordOf`, `replayQuery` |
| `@/game/deeds` | `scripts/steam-dashboard.ts`, `tests/desktop/` | `deedList` |
| `@/game/setup`, `@/game/test-files` | `src/test/`, sim tests | `worldFor`, `heroBuild`, `GAME_TEST_FILES`, `TEST_NAMES` |

Role-specific looks live in content: `look/feedback.json` `bigDeathRoles`.

## Creature art

Every creature is one still image. `src/present/anim/` moves it in code: layer 1 (`layer1.ts`,
`pose.ts`) is the body transform (gait bob and squash, hit spring and recoil, attack lunge or
cast recoil, the death pop); layer 2 (`layer2.ts`) bends a grid over the image (walk lean,
stride, idle breath); layer 3 (`layer3.ts`) poses a held prop at the bent hand. `mesh-pose.ts`
combines them into a `MeshDraw`, and `src/render/mesh-view.ts` draws it as a Phaser Mesh2D. The
numbers are content: `look/creatures.json` (gait, mesh, prop per creature) and
`look/feedback.json` (springs, lunge, death).
