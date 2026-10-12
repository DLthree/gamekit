---
name: see
description: Look at the running game. Use when you need to see a moment (a hit, a boss phase, a layout), how something moves over time, before/after a change, or any non-wave page at each device size. Tools are pnpm shot, film, ticks, screens.
---

# See the game

Every tool opens its own server on 5283 and takes the machine's browser lock (runs queue).
A query is a game URL's search part, e.g. `char=wizard&build=3&threat=3&seed=7&bot=kite`.
Tools add `seed=7`, `dev=1`, `telemetry=0`, `manual=1&agent=1` unless the query sets them, so the
same command gives the same frames.

## Aim first

```sh
pnpm ticks "<query>"            # headless: tick of each spawn, telegraph, phase, death
```

Use those ticks for `shot --tick` and `film --at` (seconds = tick / 60).

## Commands

| Need | Command | Output |
|------|---------|--------|
| One moment | `pnpm shot "<query>" --tick 600 [--name N] [--deck \| --phone [--landscape]]` | `shots/<query>-t<tick>.png` (or `--name`) + `.json` sidecar |
| Motion | `pnpm film "<query>" --at 4 --frames 8 --every 100 [--crop x,y,w,h]` | frames + `strip.png` in `shots/film/<query>/` |
| A/B | `pnpm film "<query A>" --compare "<query B>" ...` | strip with A on top, B under, frame for frame |
| Pages | `pnpm screens [--screen picker\|pause\|result\|error\|all] [--device desktop\|deck\|phone\|phone-landscape\|all]` | `shots/screens/<screen>-<device>.png` |

All take `--o PATCH` (a content override, see the `tune` skill) to look at a value before
committing it. A/B a tuning: same query, `--compare` with `--o` on one side.

## Reading output

- Open the PNG with the Read tool. Strips are wide; `--crop` (CSS px of the viewport) to zoom.
- The shot sidecar holds the world summary at that tick: check counts there, not by eye.
- Pages are the game's `SCREENS` in `src/game/links.ts`; add one there to shoot a new page.

## Pitfalls

- `film --every` must be a whole number of ticks (multiples of 1000/60 ms work: 50, 100, 200…).
- A wave is stepped (sim time); other screens run in real time, so their frames vary.
- Default device is desktop. Check the phone too (`--phone`): it is where the director plays.
- Don't open the game in a browser by hand when a tool can do it; tools are reproducible.
