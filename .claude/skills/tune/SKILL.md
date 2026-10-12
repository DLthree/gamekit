---
name: tune
description: Change game numbers and compare variants. Use when tuning balance or feel, testing a value before committing it, isolating a system, building a bench for one fight, or checking performance. Covers o= overrides, on= switches, stages, pnpm sweep and pnpm perf.
---

# Tune

Try values at runtime first; write them into `content/` once picked.

## Overrides (`o=`)

`o=<folder>/<file>.<field.path>=<JSON value>`, repeatable, in any URL or tool (`--o`):

```sh
pnpm film "<query>" --compare "<query>&o=rules/feel.hitStopS=0.12"
http://<lan-ip>:<dev port>/?<CELL>&o=rules/feel.hitStopS=0.12
```

A bad path or value stops the game with the error panel naming it.

## Switches (`on=`)

`on=a,b` turns on feature switches (`src/game/switches.ts`); each is off by default and its `cut`
removes the system from content. Use them to test a system alone or build it behind a flag.
Unknown ids fail.

## Stages (benches)

`content/stages/<id>.json`: a scenario (`from`), actors placed on tick 1 with respawn timers,
`hold` keeps the player alive. Open with `?stage=<id>&dev=1` in dev, or in any tool query. Use a
stage to compare look or feel variants side by side; keep it after the pick.

## Sweep (balance)

```sh
pnpm sweep --seeds 20                       # every run the game names × seeds 1..20
pnpm sweep --runs wizard-b3-t3 --seeds 50 --o rules/feel.hitStopS=0.1 --on throwers
pnpm sweep --seeds 20 --out scratchpad/rows.jsonl
```

Headless, parallel (cores − 2 workers), the same rows whatever the worker count. Prints the
game's table (`sweepTable` in `src/game/sweep.ts`): win %, runs, secs, kills, life lost, killers.

Before trusting a number, watch the bot: `pnpm film "<query>&bot=kite" --at 2 --frames 12 --every 500`.
A bot that stands still or dies to one thing makes every row wrong.

## Perf

```sh
pnpm perf [--dpr 3] [--o PATCH]   # frame/sim/render timings of PERF_QUERY (src/game/links.ts)
pnpm perf:check                   # exits 1 under the speed or p95 floor
```

Headless WebKit timings are information only; the phone's telemetry (`perf` records) is the judge.

## Pitfalls

- Numbers are reports, not targets; feel is judged by playing.
- Overrides don't persist. Copy the picked value into the content file and run `pnpm content:check`.
