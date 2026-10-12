---
name: diagnose
description: Find out what happened in a run. Use when a playtest reports a bug, a crash, odd balance or a stutter, before asking the director anything. Covers telemetry logs, run records and replay links.
---

# Diagnose

Telemetry plus seeded replay explain most bugs. Read them before asking.

## Telemetry

Dev and phone builds POST records to `telemetry/<YYYY-MM-DD>.jsonl` (one JSON per line, with
`receivedAt`). Kinds: `load`, `perf`, `error`, `gesture`, `deeds`, `wave`.

```sh
pnpm telemetry                     # summary of the newest log
pnpm telemetry telemetry/2026-10-11.jsonl
rg '"kind":"error"' telemetry/2026-10-11.jsonl
```

The summary is one block per session (device, time): waves with outcome and repro link, errors
with repro link, worst perf, gestures. Match the director's report by time; `load` and `error`
carry the commit.

## Replay

Each `wave` record carries a run record, `rr1;<build>;<seed>;<choice>;…`. The sim is seeded and
ticks are integers, so the same build plus record replays the run exactly.

```sh
pnpm run-record telemetry/2026-10-11.jsonl    # every record → replay link on the dev server
pnpm run-record 'rr1;abc1234;42;...'
```

Run it on the record's commit with a clean tree (`git switch --detach <build>`); a different
build is flagged and the replay may drift. Then open the link, or feed its query to
`pnpm ticks` / `pnpm film` / `pnpm shot` to see the moment (the `see` skill).

## Order of work

1. Summary → find the run and its error or odd numbers.
2. Replay link → reproduce headless (`pnpm ticks`) or in frames (`pnpm film`).
3. Write a failing test through the public interface, then fix.

## Pitfalls

- Release builds never POST; the desktop shell writes telemetry to `<userData>/telemetry/`.
- e2e runs write to `.e2e/telemetry/`, not `telemetry/`.
- A dirty tree changes the build name; commit before a phone build so records replay.
