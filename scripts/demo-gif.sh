#!/usr/bin/env bash
# Record demo GIF from VHS tape, optimize, and generate a context-safe preview.
#
# Usage:
#   ./scripts/demo-gif.sh              # record demo.tape -> assets/demo.gif
#   ./scripts/demo-gif.sh demo-split   # record demo-split.tape -> assets/demo-split.gif
#
# Produces:
#   assets/<name>.gif          -- optimized GIF for README
#   assets/<name>-preview.png  -- 300px-wide last-frame thumbnail (context-safe)

set -euo pipefail
cd "$(dirname "$0")/.."

NAME="${1:-demo}"
TAPE="${NAME}.tape"
RAW="assets/${NAME}-raw.gif"
GIF="assets/${NAME}.gif"
PREVIEW="assets/${NAME}-preview.png"

if [ ! -f "$TAPE" ]; then
  echo "error: $TAPE not found" >&2
  exit 1
fi

echo "--- recording $TAPE ---"
vhs "$TAPE"

if [ ! -f "$RAW" ]; then
  echo "error: expected $RAW from VHS output" >&2
  exit 1
fi

echo "--- optimizing ---"
gifsicle -O3 --lossy=30 --colors 128 "$RAW" -o "$GIF"
rm -f "$RAW"

echo "--- generating preview ---"
FRAMES=$(ffprobe -v quiet -count_frames -show_entries stream=nb_read_frames -of csv=p=0 "$GIF")
LAST=$((FRAMES - 1))
ffmpeg -y -i "$GIF" -vf "select='eq(n,$LAST)',scale=300:-1" -frames:v 1 "$PREVIEW" 2>/dev/null

echo "done:"
echo "  gif:     $GIF ($(du -h "$GIF" | cut -f1))"
echo "  preview: $PREVIEW ($(du -h "$PREVIEW" | cut -f1))"
