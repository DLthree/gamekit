# Project instructions

A gamekit game. README.md has the commands; docs/layout.md has the kit/game map and the seam.

## Tools

| To | Use | Skill |
|----|-----|-------|
| See a moment, a stretch, a page | `pnpm shot`, `pnpm film`, `pnpm screens`; aim with `pnpm ticks` | `see` |
| Drive the game | URLs: `?seed=`, `?bot=kite`, `?manual=1&agent=1` (step and read events through `window.__game`), `?stage=<id>&dev=1` | `see`, `tune` |
| Tune | `?o=<folder>/<file>.<path>=<json>` overrides, `?on=<switch>`, stages, `pnpm sweep`, `pnpm perf` | `tune` |
| Diagnose | `pnpm telemetry`, `pnpm run-record`, replay links | `diagnose` |
| Make art | `scripts/qwen_image.py`, `sheet.py`, `install_art.py`, `pnpm atlas` | `art` |
| Make sounds | `pnpm sounds`, `pnpm sound-sheet` | `audio` |
| Put a build on the phone | `pnpm phone <sha>` | `playtest-build` |
| Ship | `pnpm build`, `pnpm desktop:*`, `steam:*`, `itch:push`, `store-media`, `deck:check` | `ship` |

Try a tuning value with an `o=` override or a sweep before writing it into content.

## Gates

- `pnpm check` before every commit; `pnpm verify` (check + e2e) before a push or a build for the phone.
- Browser tests only through `pnpm e2e` (a hook blocks `playwright test`). One browser run at a
  time on the machine: e2e, shot, film, screens, perf, store-media and deck:check share one lock.

## Kit and game

Kit code (`src/core`, `src/sim`, `src/content`, `scripts/`, `desktop/`…) never names game content.
Game behaviour goes in `content/` or `src/game/`; the kit reaches `src/game/` only through the seam
modules in docs/layout.md. A new seam import goes in that table.

## Ports

dev 5280, e2e 5281, phone 5282, shot tools 5283, deck check 5284, preview 5289. Servers bind
0.0.0.0; links you give out use the LAN IP (`ipconfig getifaddr en0`), never localhost.

## Phone playtest

The phone is the playtest channel. Give the director links from `pnpm phone <sha>` (a pinned build
of a commit, on 5282), never the dev server: the dev server serves your work in progress and
reloads under them. Their runs land in `telemetry/<date>.jsonl`.

## Uploads

`pnpm steam:upload` and `pnpm itch:push` are dry runs. Pass `--upload` only after the director has
approved that exact build.
