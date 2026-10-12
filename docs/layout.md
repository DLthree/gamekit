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
| `src/input/` | kit | Touch stick, skill button, keyboard, mouse → one `Command` per tick. |
| `src/app/` | kit | Real-time loop, content hot reload, aim view, telemetry setup. |
| `src/agent/` | kit | `window.__game` handle, URL options, perf meter, telemetry client. |
| `src/ui/` | kit | Blocking error panel and base page styles (canvas, controls, `.panel`). |
| `src/test/` | kit | Test helpers: small synthetic content and worlds built through the game's setup. |
| `src/game/` | game | The example game's rules, screens and wiring (below). |
| `content/` | game | The example's JSON content (`content/stages/`: its benches); `content/schema/` is generated (`pnpm content:schema`). |
| `assets/` | game | Source art (creatures, fx) that `pnpm atlas` packs. |
| `public/atlas/`, `public/sounds/` | game | Packed atlas and sounds the game loads. |
| `index.html` | game | The page: canvas, controls, and one element per screen. |
| `scripts/` | kit | `shot`, `film` (frame strips over sim time), `ticks` + `timeline.ts` (headless event ticks), `screens` (non-wave pages × devices), `sweep` + `sweep-run.ts`/`sweep-worker.ts` (parallel headless bot runs), `perf`, `phone`, `telemetry`, `content-check`, `e2e` + browser guard, atlas, sounds, image prompts. |
| `scripts/game-page.ts` | kit | The WebKit tools' shared setup: browser lock, own server on 5283, device pages, `toolQuery`. |
| `tests/e2e/fixtures.ts` | kit | Playwright fixtures: error capture, `open`, touch helpers, content edits. |
| `tests/e2e/*.spec.ts` | game | Browser tests of the example game. |
| configs (`package.json`, `vite.config.ts`, `playwright.config.ts`, `tsconfig.json`, `biome.json`, `.claude/`) | kit | Build, dev server, test runner, lint, agent hooks. |

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
| `content.ts`, `schema/` | Game content kinds (`builds/`, `threats/`) and their schemas. |
| `check.ts`, `check-builds.ts` | Cross-file checks for builds, modifiers and threats. |
| `switches.ts` | The example's feature switches (`throwers`) and what each cuts when off. |
| `vocab.ts` | Name lists: tags, damage types, enemy roles. |
| `bots.ts`, `kite-bot.ts` | Bots `?bot=` can name. |
| `picker.ts`, `ui/` | The 3×3 grid model and the HUD, pause, picker and result screens. |
| `headless.ts` | A query's world without the renderer, and the events `pnpm ticks` lists. |
| `sweep.ts` | The run model `pnpm sweep` plays: run ids, one run with the kite bot, the summary table. |
| `links.ts` | Addresses the tools open: `CELL`, `PERF_QUERY`, `PHONE_QUERIES`, `SCREENS`. |
| `test-files.ts` | The game's files in the kit's test content (`heroBuild`). |

## The seam

The kit imports only these game modules. A new game provides the same exports.

| Module | Used by | Exports |
|--------|---------|---------|
| `@/game/content` | content compile, kinds, types | `GAME_KINDS` |
| `@/game/check` | `content/check.ts` | `checkGame`, `checkGameResolved` |
| `@/game/vocab` | content schemas, stats | `TAGS`, `DAMAGE_TYPES`, `ROLES` |
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
| `@/game/setup`, `@/game/test-files` | `src/test/`, sim tests | `worldFor`, `heroBuild` |

Role-specific looks live in content: `look/feedback.json` `bigDeathRoles` and
`look/creatures.json` `meshRoles`.
