#!/usr/bin/env bash
# pnpm sounds: rebuilds public/sounds/<id>.wav from CC0 recordings (Kenney, OpenGameArt), then
# the manifest. Downloads the sources once into scratchpad/sounds/raw/ (gitignored), trims,
# downmixes to mono 44.1 kHz 16-bit WAV, makes crackle loop seamlessly, and loudness-normalises
# every effect to -16 LUFS integrated (peaks limited at -1 dBFS). Each file's source and license
# is a row in public/sounds/LICENSE.md: a new sound gets its row there (CC0 only) and a tuning
# in content/look/sounds.json, which pnpm content:check holds to the files.
# Needs curl, unzip, ffmpeg.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
raw=$root/scratchpad/sounds/raw
out=$root/public/sounds
mkdir -p "$raw/oga" "$out"

fetch() { # url dest
  [[ -f $2 ]] || curl -fsSL -o "$2" "$1"
}
kenney() { # pack-slug url
  fetch "$2" "$raw/kenney_$1.zip"
  [[ -d $raw/kenney_$1 ]] || unzip -qo "$raw/kenney_$1.zip" -d "$raw/kenney_$1"
}
kenney impact-sounds https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip
kenney sci-fi-sounds https://kenney.nl/media/pages/assets/sci-fi-sounds/6b296f9ecf-1677589334/kenney_sci-fi-sounds.zip
kenney rpg-audio https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip
fetch https://opengameart.org/sites/default/files/fire.wav "$raw/oga/fire.wav"
fetch https://opengameart.org/sites/default/files/105016__julien-matthey__jm-fx-fireball-01.wav "$raw/oga/fireball-01.wav"
fetch https://opengameart.org/sites/default/files/legit_audio_fire_staff_-_free_0.zip "$raw/oga/fire-staff.zip"
[[ -d $raw/oga/fire-staff ]] || unzip -qo "$raw/oga/fire-staff.zip" -d "$raw/oga/fire-staff"

impact=$raw/kenney_impact-sounds/Audio
scifi=$raw/kenney_sci-fi-sounds/Audio
rpg=$raw/kenney_rpg-audio/Audio
staff="$raw/oga/fire-staff/LEGIT Audio_FIRE STAFF - FREE/Wavs"

MONO="aresample=44100,aformat=channel_layouts=mono"
TRIM="silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-55dB,areverse"

FX_LUFS=-16
# The most the limiter may take off a transient to reach the target (about where limiting stays
# transparent). Short, spiky clicks (stone, hit, bolt) would need far more, and squashed that
# hard they stop sounding like themselves, so they stay below the target; their volumes in
# content/look/sounds.json keep the mix as tuned.
MAX_LIMIT_DB=3

peak() { # file -> peak dBFS
  ffmpeg -hide_banner -nostats -i "$1" -af astats=measure_overall=Peak_level:measure_perchannel=none -f null - 2>&1 |
    awk '/Peak level dB/ {print $NF}'
}
# Integrated loudness (LUFS) of a file. Half a second of silence either side lets a clip shorter
# than EBU R128's 400 ms block still be measured; the silence itself falls under the gates.
lufs() { # file -> LUFS
  ffmpeg -hide_banner -nostats -i "$1" -af "adelay=500:all=1,apad=pad_dur=0.5,ebur128" -f null - 2>&1 |
    awk '/Integrated loudness/ {f=1} f && $1 == "I:" {print $2; exit}'
}
# Peak-normalises `in` to -1 dBFS, then adds gain toward `target` LUFS through a -1 dBFS lookahead
# limiter (delay-compensated, so a loop keeps its seam). The limiter takes back some loudness on
# transients, so the gain is corrected from the result (up to five passes, until within 0.2 LU),
# never past MAX_LIMIT_DB over the peak-normalised level. Logs how far over peak it went.
normalise() { # in out target codec-args...
  local in=$1 out=$2 target=$3 base g m
  shift 3
  base=$(awk -v p="$(peak "$in")" 'BEGIN{print -1-p}')
  g=$(awk -v t="$target" -v m="$(lufs "$in")" -v b="$base" 'BEGIN{print t-m-b}')
  for _ in 1 2 3 4 5; do
    g=$(awk -v g="$g" -v c="$MAX_LIMIT_DB" 'BEGIN{print (g > c ? c : g)}')
    ffmpeg -hide_banner -loglevel error -y -i "$in" \
      -af "volume=$(awk -v b="$base" -v g="$g" 'BEGIN{print b+g}')dB,alimiter=limit=0.891:level=0:latency=1:attack=2:release=40" \
      "$@" -map_metadata -1 -fflags +bitexact "$out"
    m=$(lufs "$out")
    awk -v t="$target" -v m="$m" 'BEGIN{exit !(t-m < 0.2 && m-t < 0.2)}' && break
    awk -v g="$g" -v c="$MAX_LIMIT_DB" -v t="$target" -v m="$m" 'BEGIN{exit !(g >= c && m < t)}' && break
    g=$(awk -v g="$g" -v t="$target" -v m="$m" 'BEGIN{print g+t-m}')
  done
  echo "$(basename "$out"): ${g} dB over peak-normalised -> ${m} LUFS" >&2
}
# Writes $out/<id>.wav at the effects' loudness from filter graph output in a temp file (kept in
# raw/, overwritten by the next run).
finish() { # id tmp.wav
  normalise "$2" "$out/$1.wav" "$FX_LUFS" -ac 1 -ar 44100 -c:a pcm_s16le
}
# id input channels-filter extra-filters fade-out-s [start-s duration-s]
oneshot() {
  local id=$1 in=$2 mono=$3 fx=$4 fo=$5 ss=${6:-0} t=${7:-30} tmp
  tmp=$raw/tmp-$id.wav
  ffmpeg -hide_banner -loglevel error -y -ss "$ss" -t "$t" -i "$in" -af "$mono,$TRIM${fx:+,$fx},afade=t=in:d=0.003,areverse,afade=t=in:d=$fo:curve=qsin,areverse" \
    -c:a pcm_f32le "$tmp"
  finish "$id" "$tmp"
}

oneshot bolt "$staff/LEGIT_FIR_Fire_Staff 11-Audio.wav" "$MONO" "atrim=0:0.4" 0.2
oneshot whoosh "$raw/oga/fireball-01.wav" "$MONO" "atrim=0:0.9" 0.35
# thump: the low boom with a quieter crunch on top, so it still reads on small speakers.
tmp=$raw/tmp-thump.wav
ffmpeg -hide_banner -loglevel error -y -i "$scifi/lowFrequency_explosion_001.ogg" -i "$scifi/explosionCrunch_000.ogg" \
  -filter_complex "[0]$MONO,${TRIM}[a];[1]$MONO,$TRIM,lowpass=f=5000,volume=-8dB[b];[a][b]amix=inputs=2:normalize=0:duration=longest,afade=t=in:d=0.003,areverse,afade=t=in:d=0.25:curve=qsin,areverse" \
  -c:a pcm_f32le "$tmp"
finish thump "$tmp"
oneshot puff "$scifi/explosionCrunch_002.ogg" "$MONO" "atrim=0:0.3,lowpass=f=2500" 0.18
oneshot hit "$impact/impactSoft_medium_004.ogg" "$MONO" "" 0.05
oneshot pop "$rpg/dropLeather.ogg" "$MONO" "atrim=0:0.35" 0.12
oneshot hurt "$impact/impactPunch_heavy_002.ogg" "$MONO" "atrim=0:0.35" 0.15
# slam: a heavy body thud with a rock crack on top, for the boss's ground slam.
tmp=$raw/tmp-slam.wav
ffmpeg -hide_banner -loglevel error -y -i "$impact/impactPunch_heavy_000.ogg" -i "$impact/impactMining_000.ogg" \
  -filter_complex "[0]$MONO,${TRIM}[a];[1]$MONO,$TRIM,atrim=0:0.5,volume=-6dB[b];[a][b]amix=inputs=2:normalize=0:duration=longest,afade=t=in:d=0.003,areverse,afade=t=in:d=0.2:curve=qsin,areverse" \
  -c:a pcm_f32le "$tmp"
finish slam "$tmp"
oneshot stone "$impact/footstep_concrete_000.ogg" "$MONO" "" 0.04
oneshot charge "$rpg/drawKnife2.ogg" "$MONO" "lowpass=f=4000" 0.15
# gold: handleCoins is a sparse jingle of short clinks with tall peaks. Three staged compressors
# squeeze the clinks toward the peak, so the boss-kill cue reads as a dense shimmer on a phone
# speaker (and the limiter isn't left doing that job at -16 LUFS).
GOLD_COMPRESS="acompressor=threshold=-55dB:ratio=20:attack=1:release=15:makeup=1,\
acompressor=threshold=-38dB:ratio=20:attack=1:release=15:makeup=1,\
acompressor=threshold=-20dB:ratio=15:attack=1:release=15:makeup=1"
oneshot gold "$rpg/handleCoins.ogg" "$MONO" "atrim=0:0.6,$GOLD_COMPRESS" 0.3

# crackle: 4 s of the fireplace loop, low-passed so the crackles read soft rather than as
# snaps, with its last 0.5 s crossfaded (equal power) into its head so it loops seamlessly.
L=4 X=0.5 SS=6
tmp=$raw/tmp-crackle.wav
ffmpeg -hide_banner -loglevel error -y -ss "$SS" -t "$(awk -v l=$L -v x=$X 'BEGIN{print l+x}')" -i "$raw/oga/fire.wav" \
  -filter_complex "[0]$MONO,highpass=f=90,lowpass=f=3500,lowpass=f=3500,asplit=3[h][b][t];\
[h]atrim=0:$X,asetpts=PTS-STARTPTS,afade=t=in:d=$X:curve=qsin[hi];\
[t]atrim=$L:$(awk -v l=$L -v x=$X 'BEGIN{print l+x}'),asetpts=PTS-STARTPTS,afade=t=out:d=$X:curve=qsin[to];\
[b]atrim=$X:$L,asetpts=PTS-STARTPTS[body];\
[hi][to]amix=inputs=2:normalize=0[x];[x][body]concat=n=2:v=0:a=1" \
  -c:a pcm_f32le "$tmp"
finish crackle "$tmp"

node --import "$root/scripts/node-alias.ts" "$root/scripts/sound-manifest.ts"
"$root/scripts/analyze-sounds.sh" "$out"/*.wav
