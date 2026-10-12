---
name: ship
description: Build and release the game. Use when making a release or desktop build, packaging for Steam or itch, preparing Steam achievements, making store screenshots/capsules/trailer, checking Steam Deck fit, or uploading. Uploads are dry runs until the director approves.
---

# Ship

## Release build

`pnpm build` (`vite build --mode release`) is what players get: dev URL parameters are refused
(`RELEASE_REFUSED` in `src/agent/url-options.ts`), no stages, no `window.__game`, telemetry never
POSTs, the error panel hides raw lines behind Details. `scripts/release-build.test.ts` holds it to
that. `pnpm preview` serves it on 0.0.0.0 (`PORTS.preview`, scripts/ports.ts).

## Desktop (Electron)

```sh
pnpm desktop                              # itch flavour (DRM-free), runs the build
pnpm desktop:steam                        # Steam flavour
pnpm desktop:dist --itch [--mac] [--win] [--linux] [--dir]    # → release/itch/
pnpm desktop:dist --steam --mac --dir                         # → release/steam/
pnpm desktop:smoke                        # Electron e2e: saves across relaunch, corrupt save, Steam without Steam
```

Saves go to disk in the shell, localStorage on the web (`src/app/platform.ts`). The Steam flavour
needs `vendor/steamworks_sdk/` (gitignored) and real IDs in `ship/config.json`.

## Store and platform data

| Command | Output |
|---------|--------|
| `pnpm steam:achievements` | `release/steam-dashboard/achievements.{csv,json}` from `content/deeds/`; paste into Steamworks. |
| `pnpm store-media [all\|shots\|art\|capture\|trailer\|gifs\|sheet] [--only N,…]` | `release/store/`: screenshots, capsules, trailer.mp4, GIFs, sheet.png, from `ship/media.json`. |
| `pnpm deck:check` | `shots/deck-check/report.{json,md}` + a shot per screen: pad-only reach, text sizes, mouse/keyboard words. On demand, not in a gate. |

`ship/media.json` picks moments as a query, optional `actions` and frames (`frames`, a shot's or
a game beat's); after a balance or art change re-run and check the moments still land
(`pnpm ticks` prints a real-time fight's moments as frames, to re-aim).

## Uploads (dry runs)

```sh
pnpm steam:upload [--desc "note"]       # writes release/steampipe/*.vdf, prints the steamcmd line
pnpm itch:push                          # prints the butler commands, one channel per OS
```

Add `--upload` (and `--user <login>` for Steam) only after the director approves that exact build.
A Steam upload is not set live; the dashboard's Builds page does that.

## Pitfalls

- `steam:upload` refuses TODO IDs and Spacewar (480), and uploads only from macOS.
- `itch:push --upload` needs `butler login` once.
- Packages are unsigned.
