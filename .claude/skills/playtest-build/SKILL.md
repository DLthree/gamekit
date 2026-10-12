---
name: playtest-build
description: Put a build on the director's phone. Use when a change is ready to playtest, when the director asks for a link, or when a playtest link must be refreshed. Covers pnpm phone <sha>.
---

# Playtest build

The phone is the playtest channel. The director plays a pinned build, never the dev server,
which serves work in progress and reloads under them.

## Steps

```sh
pnpm verify                  # the gate, before anything goes to the phone
git commit ...               # the build must be a commit (records name it)
pnpm phone <sha>             # builds <sha> in .phone/ and serves it on 0.0.0.0 (PORTS.phone)
```

Run `pnpm phone` in the background; it keeps serving. It prints one link per `PHONE_QUERIES`
entry (`src/game/links.ts`) on the LAN IP: send those links. Add queries there for what this
round tests (a stage, a cell, a switch).

## After the playtest

Their runs go to this checkout's `telemetry/<date>.jsonl`. Use the `diagnose` skill:
`pnpm telemetry`, then `pnpm run-record` for replay links.

## Pitfalls

- A new `pnpm phone <sha>` replaces the build in `.phone/`; stop the old server first (`PORTS.phone`
  is strict).
- `.phone/` is a git worktree the script manages; leave it alone.
- Use the LAN IP (`ipconfig getifaddr en0`), never localhost.
- Phone and machine must be on the same network.
