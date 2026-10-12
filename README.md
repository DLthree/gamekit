# gamekit

A game architecture plus a toolbelt that lets an AI agent see, drive, test and tune a game on its
own. It ships with a small working example (a wizard, a 3×3 build × threat picker, waves, an elite
and a boss) wired to every tool. Copy the repo, then replace the example: [docs/new-game.md](docs/new-game.md).

## The five properties

| Property | Means | Delivered by |
|----------|-------|--------------|
| Observable | The agent can see any moment, change over time, and what happened when. | `pnpm shot`, `pnpm film`, `pnpm ticks`, `pnpm screens`, telemetry |
| Drivable | A typed handle and scenario URLs; bots, tests and tools take the path a player does. | `window.__game`, `?bot=`, `?stage=`, `pnpm e2e` |
| Deterministic | One seeded RNG, integer ticks; any run replays exactly from its seed and record. | `src/core/`, `pnpm run-record` |
| Headless | The sim runs without the renderer, fast and in parallel. | `pnpm sweep`, `pnpm test` |
| Data-driven | Content is validated JSON, tunable at runtime; bad content stops the game with a panel naming file and field. | `content/`, `?o=`, `?on=`, `pnpm content:check` |

Notes:

- Telemetry plus seeded replay explain most bugs. Read them before asking anyone.
- Check the bot before trusting a balance number: film it playing (`?bot=kite`).
- Metrics are reports, not targets. Feel is judged by playing.
- Headless is not the device. The phone playtest stays.

## Quickstart

```sh
pnpm install
pnpm dev                 # dev server on 0.0.0.0 (ports: scripts/ports.ts)
pnpm phone <sha>         # pinned build of a commit for the phone
pnpm verify              # check + e2e, the full gate
```

Needs Node ≥ 26.10, pnpm, `uv` (Python scripts), ffmpeg (sounds, store media), `prek` (`pnpm
install` installs the commit and push hooks with it). Art generation
reads `KIE_API_KEY` from the env or a gitignored `.env`.

## Kit and game

Every file is **kit** (keep) or **game** (the example; replace). Kit code never names game
content; the game reaches the kit through `content/` and the seam modules in `src/game/`. The kit
is two layers: core (any game) and the opt-in real-time layer (`src/realtime/`). The layers, file
map and seam: [docs/layout.md](docs/layout.md).

## Commands

| Command | What it does |
|---------|--------------|
| `pnpm dev` | Vite dev server with hot content reload. |
| `pnpm phone <ref>` | Builds `<ref>` in `.phone/` and serves it to the LAN; prints the links. |
| `pnpm check` | typecheck, lint, content:check, test, test:py. The commit gate. |
| `pnpm verify` | check + e2e. The push gate. |
| `pnpm e2e [args]` | Playwright, the only way to run browser tests (browser lock, capped workers). |
| `pnpm typecheck` / `lint` / `format` | tsc; biome check; biome fix (also formats JSON a script wrote). |
| `pnpm test` / `test:py` | vitest; pytest over `scripts/*_test.py`. |
| `pnpm content:check` | Compile and cross-check `content/`; exit 1 on any problem. |
| `pnpm content:schema` | Rewrite `content/schema/*.schema.json` from the Zod schemas. |
| `pnpm shot "<q>" [--actions JSON] [--frames N]` | A PNG of one moment (actions, then N kit-clock frames) + JSON sidecar in `shots/`. |
| `pnpm film "<q>" [--actions JSON] --at N --frames 8 --every 6` | A frame strip from that moment; `--compare` for A/B. |
| `pnpm ticks "<q>"` | Real-time, headless: the frames of a run's telling moments, to aim shot/film. |
| `pnpm screens` | Every non-wave page at every device size. |
| `pnpm sweep [--runs] [--seeds N]` | Parallel headless bot runs, summary table. |
| `pnpm perf` / `perf:check` | Frame, sim and render timings of the heaviest scenario; `:check` fails on a floor. |
| `pnpm telemetry [file]` | Summarise the newest telemetry log. |
| `pnpm run-record <jsonl\|rr1;…>` | Run records → replay links. |
| `pnpm atlas` | Pack `assets/` into `public/atlas/` and the sprite manifest. |
| `pnpm sounds` | Fetch, trim, loop and loudness-match the CC0 sounds; writes the manifest. |
| `pnpm sounds:manifest` | Rewrite the sound manifest from `public/sounds/`. |
| `pnpm sound-sheet` | A listening page of every sound. |
| `uv run scripts/qwen_image.py` | Generate art in a house-style preset. |
| `uv run scripts/sheet.py` | Contact sheet of images, or each in game and at phone size. |
| `uv run scripts/install_art.py` | Trim, pivot and install a picked image, then pack. |
| `uv run scripts/icon.py <sprite>` | `ship/icon.png` from a sprite. |
| `pnpm build` / `preview` | The release build (dev surface stripped) and its preview server. |
| `pnpm desktop` / `desktop:steam` | The release build in Electron, itch or Steam flavour. |
| `pnpm desktop:dist --itch\|--steam` | Package into `release/<flavour>/`. |
| `pnpm desktop:compile` | Compile the Electron shell only (used by the commands above). |
| `pnpm desktop:smoke` | Electron e2e on the release build. |
| `pnpm steam:achievements` | Steam dashboard achievement rows from the deeds. |
| `pnpm steam:upload` / `itch:push` | Dry runs unless `--upload`. |
| `pnpm store-media` | Store screenshots, capsules, trailer and GIFs from `ship/media.json`. |
| `pnpm deck:check` | Steam Deck pad-only walk, text sizes, shots. On demand. |

Each tool family has a skill in `.claude/skills/` with flags and pitfalls.

## Licence

MIT (code and images). Sounds are CC0, see `public/sounds/LICENSE.md`.
