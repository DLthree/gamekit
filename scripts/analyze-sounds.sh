#!/usr/bin/env bash
# Prints duration, integrated loudness (LUFS, padded as scripts/build-sounds.sh measures it), peak/RMS
# dB and mean spectral centroid (Hz) per audio file, to pick placeholders by ear-proxy.
set -euo pipefail
for f in "$@"; do
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
  s=$(ffmpeg -hide_banner -nostats -i "$f" -ac 1 -af "astats=measure_overall=Peak_level+RMS_level:measure_perchannel=none" -f null - 2>&1 | grep -oE '(Peak|RMS) level dB: [-0-9.inf]+' | awk '{print $1"="$4}' | tr '\n' ' ')
  l=$(ffmpeg -hide_banner -nostats -i "$f" -af "adelay=500:all=1,apad=pad_dur=0.5,ebur128" -f null - 2>&1 | awk '/Integrated loudness/ {f=1} f && $1 == "I:" {print $2; exit}')
  c=$(ffmpeg -hide_banner -nostats -i "$f" -ac 1 -af "aspectralstats=measure=centroid,ametadata=print:key=lavfi.aspectralstats.1.centroid:file=-" -f null - 2>/dev/null | grep -oE 'centroid=[0-9.]+' | awk -F= '{s+=$2;n++} END{if(n) printf "%.0f", s/n}')
  printf '%-24s %6.2fs lufs=%s %s centroid=%s\n' "$(basename "$f")" "$d" "$l" "$s" "$c"
done
