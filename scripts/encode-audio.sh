#!/usr/bin/env bash
#
# Re-encode the game's sound effects for the web.
#
# The clips are authored as 48 kHz 16-bit stereo WAV, which is what the mobile
# app ships: on a phone they are already on the device, so size costs nothing.
# On the web every byte crosses a network before the first cue can play, and
# 33 seconds of PCM is 6.2 MB — enough that the first sound of a match could
# still be downloading when it was asked to play.
#
# AAC at 128 kbps keeps both channels and the full sample rate and costs about
# 560 KB for the whole set: a 91% reduction for material that is a handful of
# short UI blips. Every browser the app supports decodes AAC natively.
#
# Sources live in `audio-src/` and are NOT served. Only the encoded files in
# `public/audio/` ship, which is why the originals sit outside `public/`.
#
# Usage:  npm run encode:audio
set -euo pipefail

cd "$(dirname "$0")/.."

SRC="audio-src"
OUT="public/audio"
BITRATE="128000"

if [ ! -d "$SRC" ]; then
  echo "error: no $SRC directory — nothing to encode." >&2
  exit 1
fi

mkdir -p "$OUT"

# ffmpeg where it exists (Linux, CI); afconvert is built into macOS, so a
# developer on a Mac needs nothing installed.
if command -v ffmpeg >/dev/null 2>&1; then
  encode() { ffmpeg -nostdin -loglevel error -y -i "$1" -c:a aac -b:a "$BITRATE" "$2"; }
elif command -v afconvert >/dev/null 2>&1; then
  encode() { afconvert -f m4af -d aac -b "$BITRATE" "$1" "$2"; }
else
  echo "error: needs ffmpeg or afconvert on PATH." >&2
  exit 1
fi

count=0
skipped=0
for wav in "$SRC"/*.wav; do
  [ -e "$wav" ] || continue
  name="$(basename "$wav" .wav)"
  m4a="$OUT/$name.m4a"

  # Skip anything already newer than its source, so a re-run is cheap.
  if [ -f "$m4a" ] && [ "$m4a" -nt "$wav" ]; then
    skipped=$((skipped + 1))
    continue
  fi

  encode "$wav" "$m4a"
  count=$((count + 1))
done

echo "encoded $count clip(s), skipped $skipped already current"
du -sh "$OUT"
