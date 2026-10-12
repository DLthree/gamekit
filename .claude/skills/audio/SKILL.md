---
name: audio
description: Add, replace or tune sounds. Use when the game needs a new sound effect, a sound is too loud, quiet or wrong, or to listen through every sound. Covers scripts/build-sounds.sh (pnpm sounds), the manifest and pnpm sound-sheet.
---

# Audio

Sounds are CC0 recordings (Kenney, OpenGameArt entries marked CC0), cut and levelled by one script.

## Add or replace a sound

1. Find a CC0 source; confirm the license on its page.
2. In `scripts/build-sounds.sh`, add a `fetch`/`kenney` line for the source and a `oneshot` line
   cutting `public/sounds/<id>.wav` from it (the trim, loop and loudness functions are kit).
3. Add a row to `public/sounds/LICENSE.md`: `| file | source | original file | license |`.
4. Add its tuning to `content/look/sounds.json` (`cap`, `minGapS`, `volume`, `pitch`, `loop`) and
   name it in an effect's `sound` in `content/look/fx.json`.
5. Run:

```sh
pnpm sounds            # downloads once to scratchpad/sounds/raw/, cuts, -16 LUFS, manifest
pnpm content:check     # manifest matches the files, every sound has a tuning
pnpm sound-sheet       # scratchpad/sound-sheet/index.html: every sound, its level and credit
scripts/analyze-sounds.sh public/sounds/<id>.wav    # length, loudness, brightness
```

## Tune

Level and pitch live in `content/look/sounds.json`; try them with an override first
(`o=look/sounds.sounds.bolt.volume=0.3`). `cap` limits voices at once, `minGapS` spaces repeats.

## Pitfalls

- CC0 only; a test fails on a shipped sound without a CC0 row in LICENSE.md.
- Needs curl, unzip, ffmpeg.
- Headless can't judge a mix. The sound sheet and the phone can.
- Which effect plays which sound: the `sound` field of each recipe in `content/look/fx.json`.
