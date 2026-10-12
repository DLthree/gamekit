# Layout: kit and game

Every file is **kit** (keep it when you make a new game) or **game** (the example: a wizard, a
3×3 build × threat picker, waves, an elite and a boss; replace it). Kit code never names game
content (wizard, fireball, snail…). Game behaviour reaches the kit through content data and the
seam modules listed below.

## Layers

The kit has two layers; dependencies point down only: game → realtime → core.

- **core**: real-time and genre agnostic. Content pipeline (sound kinds only), seeded RNG, the
  kit frame clock (tool mode steps it; the sim, rendering and animations run in its frames),
  vectors, agent handle (kit part), telemetry, run record, save, error panel, menu input and UI,
  the tools, the desktop shell. A turn-based game keeps only this.
- **realtime** (`src/realtime/`, `scripts/realtime/`): opt-in. Sim, presentation, renderer,
  stick/gesture/aim input, the loop, the perf meter, the real-time content kinds and checks
  (`REALTIME_KINDS`, `checkRealtime`), and the `ticks` and `perf` tools. A turn-based game deletes
  both folders and their package.json scripts.
- **game**: `src/game/`, `content/`, `assets/`, the e2e specs. The example uses core + realtime.

`scripts/layers.test.ts` fails if core imports realtime, or core or realtime import a game module
outside the seam below; `scripts/package-scripts.test.ts` fails if a package.json script names a
file or script that doesn't exist.

Tools by layer:

- **core**: `shot`, `film`, `screens`, `sweep`, `telemetry`, `run-record`, `phone`, `e2e`,
  `content:check`/`content:schema`, `sounds`, `sound-sheet`, `qwen_image.py`, `sheet.py` (grid),
  `icon.py`, `build`, `desktop*`, `steam:*`, `itch:push`, `store-media`, `deck:check`.
- **realtime**: `ticks`, `perf`/`perf:check`, and the sprite pipeline that feeds the real-time
  renderer (`atlas`, `install_art.py`, `sheet.py --game`: they write or read
  `content/look/generated/sprites.json`, a real-time kind).

## Map

| Path | Layer | What it does |
|------|-------|--------------|
| `src/core/` | core | The kit frame clock (`frames.ts`: the display drives it, or a tool steps it with `manual=1`), fixed-tick clock, seeded RNG, vectors. |
| `src/content/` | core | Content pipeline: load (browser and Node), overrides, compile, cross-file checks, errors. |
| `src/content/kind.ts`, `kinds.ts` | core | A kind (folder or file → schema), `Compiled<…>` types; the kit's kinds (sounds) beside the game's `GAME_KINDS` (`{ sim, look }`). |
| `src/content/switches.ts` | core | Feature switches: `on=a,b` parsing (unknown ids fail) and `switchOn`, which cuts the off systems from a frozen copy. |
| `src/content/schema/` | core | Zod schemas for sounds, `SchemaRef`, `ContentId`. |
| `src/content/achievements.ts` | core | Deeds → Steam achievements (`DEED_<ID>` API names) and their checks. |
| `src/agent/` | core | `window.__game` handle (`KitHandle`: screen, state, the clock's `frame`/`frames`, the game's `act`), URL options, telemetry client, run record (`record.ts`). |
| `src/app/` | core | Content hot reload, telemetry setup, audio unlock, `platform.ts` (the save port: disk in the desktop shell, localStorage on the web; Steam's problem and deed unlocks). |
| `src/input/` | core | Gamepad (`gamepad.ts`), iOS Safari guards. |
| `src/ui/` | core | Blocking error panel, base page styles on theme variables (`page.css`: `--page-bg`, `--page-ink`, `--panel-bg`, `--act-bg`, `--act-ink`, `--page-font`; `.panel`, `.act`), the action button (`button.ts`), gamepad menu navigation (`pad-nav.ts`) and pad shortcut hints (`pad-keys.ts`, from a game's `PadKeyMap`), and the dev terms no player may read (`vocabulary.ts`, checked by the game's `ui/vocabulary.test.ts`). |
| `src/test/` | core | Kit test helpers: the repo's content patched (`testFiles`, `testContent`) and found without naming game files (`aCollection`, `aSimEdit`); a kit test skips when the game has none of a thing. `contentFixture` builds a layer's own small fixture; `KIT_TEST_FILES` is the kit's kinds in one. A fake pad (`pad.ts`). |
| `src/realtime/sim/` | realtime | Headless sim: world, 10-phase step, actors, AI, skills, volumes, combat, stats, events, snapshot; `stage.ts`, a running bench (actors placed on tick 1, respawned at their places; the player's life floors at 1). |
| `src/realtime/present/` | realtime | Sim events → what to draw and play: animation poses, fx pool and recipes, camera, telegraphs, sound plan. |
| `src/realtime/render/` | realtime | Phaser boot, the world scene and its views, audio output. |
| `src/realtime/input/` | realtime | Touch stick, skill button, keyboard, mouse → one `Command` per tick. |
| `src/realtime/app/` | realtime | The fixed-tick loop (kit-clock frames in, ticks out; stepped, one tick a frame), aim. |
| `src/realtime/content/` | realtime | `REALTIME_KINDS` (characters, skills, modifiers, enemies, stages, rules, look, sprites), their schemas and vocab, `checkRealtime`, loadouts, the atlas frame check. |
| `src/realtime/agent/` | realtime | Perf meter; perf and gesture telemetry records and their summary lines. |
| `src/realtime/core/` | realtime | Packed ids, spatial hash. |
| `src/realtime/test/` | realtime | The real-time tests' small content (`content.ts`: the kit's and the game's `GAME_TEST_FILES`), test files for the real-time kinds, worlds built through the game's setup, `vocab.ts` (the game's `TEST_NAMES`, never the example's words). |
| `src/realtime/arena.css` | realtime | The canvas host, touch zone, stick and skill button styles, on the theme variables. |
| `desktop/` | core | The Electron shell: `main.ts` (app:// on dist/, window mode, single instance), `preload.ts` (`window.gameDesktop`), atomic saves and telemetry files (`files.ts`), `ship.ts` (reads and checks `ship/config.json`), Steam (`steam*.ts`, the Steam flavour only). |
| `ship/` | game | What the game publishes as: `config.json` (product name, bundle id, Steam App and depot IDs, itch target; "TODO" placeholders until filled), `media.json` (the store media manifest), `icon.png`. |
| `src/game/` | game | The example game's rules, screens and wiring (below). |
| `content/` | game | The example's JSON content (`content/stages/`: its benches); `content/schema/` is generated (`pnpm content:schema`). |
| `assets/` | game | Source art that `pnpm atlas` packs: `creatures/<id>.png` + sidecar, `fx/<id>/<n>.png` + `fx/<id>.json`. |
| `assets/style/` | game | The house style: `presets.json` (prompt wrappers for `qwen_image.py --preset`) and `anchor.png`, the style reference. |
| `public/atlas/`, `public/sounds/` | game | Packed atlas and sounds the game loads; `public/sounds/LICENSE.md` credits each sound (CC0 only). |
| `index.html` | game | The page: canvas, controls, and one element per screen. |
| `scripts/` | core | `shot`, `film` (frame strips: actions, then kit-clock frames), `screens` (non-wave pages × devices), `sweep` + `sweep-run.ts`/`sweep-worker.ts` (parallel headless bot runs), `run-record` + `run-record-read.ts` (records → replay links), `phone`, `telemetry`, `content-check`, `e2e` + browser guard (one machine-wide lock, `~/.cache/browser-guard/lock`), and the art, audio and ship tools (README.md's command table; `.claude/skills/` for each family). |
| `scripts/realtime/` | realtime | `ticks` + `timeline.ts` (headless: the frame of each telling moment), `perf` / `perf:check` (timings of `PERF_QUERY`). |
| `scripts/build-sounds.sh` | core + game | The loudness and loop functions are kit; the fetch and `oneshot` lines are the example's sounds, replaced per game. |
| `scripts/game-page.ts` | core | The WebKit tools' shared setup: browser lock, own server on the tools port, device pages, `toolQuery`, `reach` (actions, then frames). |
| `tests/e2e/fixtures.ts` | core | Playwright fixtures: error capture, `open`, `mouseClick` / `fingerTap` (reach an element by wheel or swipe as a player does, fail if it is covered or out of reach, then press it for real), raw touch pointer events, content edits. |
| `tests/fixtures/turn/`, `tests/e2e/turn-clock.spec.ts` | core | A turn-based page in miniature (an action, then a 30-frame slide) proving the tools' time model without a game. |
| `tests/desktop/` | core | The desktop smoke test (`pnpm desktop:smoke`): saves across a relaunch, a corrupt save, the Steam build without Steam. |
| `tests/deck/pad.ts`, `setup.ts`, `teardown.ts` | core | The Deck check's scripted pad, focus walker, text measure and report. |
| `tests/deck/walk.spec.ts` | game | The example's pad-only walk. |
| `tests/e2e/wave.ts` | game | The example's wave helpers for its specs (`playing`, `waitForCast`, `buttonCenter`). |
| `tests/e2e/*.spec.ts` | game | Browser tests of the example game; `layout.spec.ts` holds each screen's element boxes equal across its states (stable layout), `gamepad.spec.ts` plays it with a scripted pad. A test with `@touch` in its title runs on the phone project only; the rest run on desktop. |
| `README.md`, `CLAUDE.md`, `docs/`, `.claude/skills/` | core | What the kit is, the agent's project instructions, this map, the new-game steps, one skill per tool family. |
| `scripts/ports.ts` | core | Every server port, from one base; configs and scripts read it. |
| configs (`package.json`, `vite.config.ts`, `playwright.config.ts`, `playwright.desktop.config.ts`, `playwright.deck.config.ts`, `tsconfig.json`, `biome.json`, `.claude/`) | core | Build, dev server, test runner, lint, agent hooks. |

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
| `handle.ts` | `GameHandle`: the example's part of `window.__game` (wave state, events, fx, sound…). |
| `actions.ts` | The example's scripted action (`act`, a tool's `--actions`): a command held for N frames. |
| `telemetry.ts` | `RunReport` (the wave report + sound), `GameRecord` (perf, gestures) and their `pnpm telemetry` lines. |
| `content.ts`, `schema/` | `GAME_KINDS`: the real-time kinds plus the example's (`builds/`, `threats/`, `deeds/`) and their schemas. |
| `deeds.ts` | Deeds: which a wave meets, the `deeds` save, `deedList` for the kit. |
| `check.ts`, `check-builds.ts` | Cross-file checks: `checkRealtime`, then builds, modifiers and threats; `checkGameFiles` (the atlas). |
| `switches.ts` | The example's feature switches (`throwers`) and what each cuts when off. |
| `vocab.ts` | Name lists: tags, damage types, enemy roles, wave outcomes. |
| `bots.ts`, `kite-bot.ts` | Bots `?bot=` can name. |
| `behaviors.ts` | The game's own enemy behaviours (none in the example). |
| `picker.ts`, `ui/` | The 3×3 grid model and the HUD, pause, picker and result screens; `ui/pad-keys.ts` is their pad shortcuts. |
| `headless.ts` | A query's world without the renderer, and the events `pnpm ticks` lists. |
| `sweep.ts` | The run model `pnpm sweep` plays: run ids, one run with the kite bot, the summary table. |
| `record.ts` | The example's run record: its choices (the replay address's parameters) and `replayQuery`. |
| `links.ts` | Addresses the tools open (`CELL`, `PERF_QUERY`, `PHONE_QUERIES`, `SCREENS`) and the ids specs and tests name (`HERO`, `CAST_SKILL`, `BOT`, `SWITCH`, `STAGE`). |
| `test-files.ts` | The game's files in the real-time tests' content (the real-time files, `heroBuild`, `GAME_TEST_FILES`) and the names it uses (`TEST_NAMES`). |

## The seam

Core and realtime import only these game modules (`scripts/layers.test.ts` lists them too). Every
game provides the nine core ones; a real-time game also the realtime ones. Anything else core
needs from the game it takes as a parameter (the bot ids `parseOptions` accepts, the words
`summarizeTelemetry` prints).

| Module | Layer | What the kit needs from the game | Exports |
|--------|-------|-------------------------|---------|
| `@/game/content` | core | Its content kinds, compiled beside the kit's. | `GAME_KINDS` |
| `@/game/check` | core | Its cross-file content rules, run by `content:check` and every load. | `checkGame`, `checkGameResolved`, `checkGameFiles` |
| `@/game/handle` | core | Its part of `window.__game`. | `GameHandle` |
| `@/game/telemetry` | core | Its run report and records, and their `pnpm telemetry` lines. | `RunReport`, `GameRecord`, `runLines`, `sessionLines` |
| `@/game/record` | core | How a run record becomes a replay address (`run-record`, `telemetry`). | `replayQuery` |
| `@/game/links` | core, realtime | The addresses the tools open (`phone`, `screens`; realtime: `perf`, `ticks`). | `PHONE_QUERIES`, `SCREENS`; `PERF_QUERY` |
| `@/game/sweep` | core | One headless run and the summary table (`pnpm sweep`). | `SweepRow`, `sweepRuns`, `playRun`, `sweepTable` |
| `@/game/switches` | core | Its feature switches (may be `{}`). | `SWITCHES` |
| `@/game/deeds` | core | Its deeds as Steam achievements (`steam:achievements`, desktop smoke). | `deedList` |
| `@/game/scenario` | realtime | One run's setup (world, snapshot). | `Scenario` |
| `@/game/bots` | realtime | The bots `ticks` plays. | `BOTS`, `BOT_IDS` |
| `@/game/test-files` | realtime | Its files in the real-time tests' small content. | `GAME_TEST_FILES`, `TEST_NAMES`, `heroBuild` |
| `@/game/vocab` | realtime | content schemas, stats, events | `TAGS`, `DAMAGE_TYPES`, `ROLES`, `OUTCOMES` |
| `@/game/report` | realtime | step, world | `WaveReport`, `recordEvents` |
| `@/game/wave/director`, `@/game/wave/tick` | realtime | world, step | `WaveState`, `tickWave` |
| `@/game/behaviors` | realtime | AI (step phase 2), content check | `BEHAVIORS` (may be `{}`) |
| `@/game/headless` | realtime | `scripts/realtime/timeline.ts` | `worldForQuery`, `tickLine` |
| `@/game/setup` | realtime | `src/realtime/test/world.ts` | `worldFor` |

Role-specific looks live in content: `look/feedback.json` `bigDeathRoles`.

## What the sim expresses

Check a new game's mechanics against this before planning; anything outside it is either game
code at a seam or a kit edit.

| Mechanic | The sim does | Content / seam |
|----------|--------------|----------------|
| Player movement | Direct: position += stick × `moveSpeed` each tick (no inertia), knockback on top, clamped to the arena. | `characters/*.json` stats, `rules/movement.json`, `rules/arena.json` |
| Enemy movement | `chase`, `keepDistance`, or a game behaviour; separation pushes enemies apart. | `enemies/*.json` `behavior`; `src/game/behaviors.ts` |
| Skills | Auto (by rate) or manual (cooldown, aimed); targets `nearest`, `aim`, `player`. | `skills/*.json` |
| Delivery | A tree of primitives: `projectile` (fan, nearest, nova, scatter; pierce; damage or trigger), `burst` (circle, arc, lane; warned telegraphs), `zone` (static, pulsing), `dash`; children on end. | `skills/*.json` `deliver`, `modifiers/*.json` `attach` |
| Damage | Sum of the game's damage types; tags select StatMods; knockback. No armour or resistances. | `DAMAGE_TYPES`, `TAGS` |
| Spawns | Whatever the game queues: `queueEnemy(world, def, x, y)` in step phase 9, joined in phase 10. Placement helpers: `src/realtime/sim/spawn-points.ts` (`edgePoint`, `ringPoints`, `fieldPoints`). | `src/game/wave/` (`tickWave`) |
| On death | Phase 9 sees this tick's `died` events (`world.events`), so "dies → splits" or "dies → drops" is game code in `tickWave`. | `src/game/wave/` |
| Win and loss | Game code sets `world.outcome` and pushes `waveEnded`. | `OUTCOMES`, `src/game/wave/` |

A new enemy movement: add a function to `src/game/behaviors.ts` `BEHAVIORS` (it sets
`actor.moveX`/`moveY` each tick; keep per-actor state in the game's `WaveState`) and name it in
the enemy file as `behavior: { kind: "game", id }`. Player inertia, a new delivery primitive or a
spawn with a starting velocity are kit edits (`src/realtime/sim/actors/movement.ts`, `src/realtime/sim/skills/`,
`src/realtime/sim/spawn-queue.ts` with their schemas in `src/content/schema/`); make them content-driven so
they can go back to the template.

## Creature art

Every creature is one still image. `src/realtime/present/anim/` moves it in code: layer 1 (`layer1.ts`,
`pose.ts`) is the body transform (gait bob and squash, hit spring and recoil, attack lunge or
cast recoil, the death pop); layer 2 (`layer2.ts`) bends a grid over the image (walk lean,
stride, idle breath); layer 3 (`layer3.ts`) poses a held prop at the bent hand. `mesh-pose.ts`
combines them into a `MeshDraw`, and `src/realtime/render/mesh-view.ts` draws it as a Phaser Mesh2D. The
numbers are content: `look/creatures.json` (gait, mesh, prop and scale per creature; gait kind
`rigid` turns layers 1–2 off for objects) and
`look/feedback.json` (springs, lunge, death).
