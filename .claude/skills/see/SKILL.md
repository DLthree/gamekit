---
name: see
description: Look at the running game. Use when you need to see a moment (a hit, a turn, a layout), how something moves over time, before/after a change, or any page at each device size. Tools are pnpm shot, film, screens (core) and pnpm ticks (realtime).
---

# See the game

Every tool opens its own server (`PORTS.tools`) and takes the machine's browser lock (runs queue).
A query is a game URL's search part (the example's: `char=wizard&build=3&threat=3&bot=kite`).
Tools add `seed=7`, `dev=1`, `telemetry=0`, `manual=1&agent=1` unless the query sets them, so the
same command gives the same frames.

## Time: actions, then frames

With `manual=1` the page moves only when a tool steps the kit frame clock (`src/core/frames.ts`):
the sim, rendering and the game's animations all run in its frames (60 a second of page time). A
moment is reached by **actions** (`--actions '<JSON array>'`, each replayed through
`window.__game.act`, in the game's own shape) and then **frames**. The example's action is a
command held for N frames: `{"frames": 30, "move": [1, 0], "cast": [1, 0]}` (`src/game/actions.ts`);
a turn-based game's is a move, and a moment is its moves then a few frames of animation. With a
`bot=` in the query the bot plays, so a moment is just frames into the run.

## Aim first (realtime)

```sh
pnpm ticks "<query>"            # headless: the frame of each spawn, telegraph, death, end
```

Its numbers are frames: pass them to `shot --frames` and `film --at` (with no `--actions`).

## Commands

| Need | Command | Output |
|------|---------|--------|
| One moment | `pnpm shot "<query>" [--actions '[…]'] --frames 600 [--name N] [--deck \| --phone [--landscape]]` | `shots/<query>[-a<hash>]-f<frames>.png` (or `--name`) + `.json` sidecar |
| Motion | `pnpm film "<query>" [--actions '[…]'] --at 240 --frames 8 --every 6 [--crop x,y,w,h]` | 8 images, the first `--at` frames after the actions, then one every 6 frames, + `strip.png` in `shots/film/<query>/` |
| A/B | `pnpm film "<query A>" --compare "<query B>" ...` | strip with A on top, B under, frame for frame |
| Pages | `pnpm screens [--screen <id>\|all] [--device desktop\|deck\|phone\|phone-landscape\|all]` | `shots/screens/<screen>-<device>.png` |

All take `--o PATCH` (a content override, see the `tune` skill) to look at a value before
committing it. A/B a tuning: put the patch in one query,
`pnpm film "<q>" --compare "<q>&o=<patch>"`; `--o` patches both rows (each row is captioned with
its patches; identical rows are refused).

## Reading output

- Open the PNG with the Read tool. Strips are wide; `--crop` (CSS px of the viewport) to zoom.
- The shot sidecar holds the actions, the frames, the clock's frame index and the handle's `state()` there (the example: the world summary): check counts there, not by eye.
- Pages are the game's `SCREENS` in `src/game/links.ts`; add one there to shoot a new page.

## Pitfalls

- Every page is stepped: frames past a run's end show its result page; CSS transitions and
  anything the game doesn't run on the kit clock are not frame-exact.
- Hit-stop freezes take frames but not sim ticks, so the sidecar's `state().tick` can lag the frame.
- Default device is desktop. Check the phone too (`--phone`): it is where the director plays.
- Don't open the game in a browser by hand when a tool can do it; tools are reproducible.
