#!/usr/bin/env bash
# tresh full demo -- real Claude Code, push + poll modes
#
# Two tmux panes. Bob (left) and Alice (right).
# Phase 1: Push mode -- bob watches, alice sends, instant delivery
# Phase 2: Poll mode -- alice watches, bob sends, delayed delivery
# Phase 3: Real Claude Code -- both launch, chat via ! tresh, /exit
# Phase 4: Terminal goodbye
#
# Usage:
#   ./scripts/demo-split.sh              # run demo, attach to watch
#   ./scripts/demo-split.sh --record     # record with asciinema -> GIF

set -euo pipefail
cd "$(dirname "$0")/.."

SESSION="tresh-demo"
TRESH_DIR="/tmp/tresh-demo-real"
TRESH_CMD="bun run $(pwd)/src/cli.ts"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

cleanup() {
  tmux kill-session -t "$SESSION" 2>/dev/null || true
  rm -rf "$TRESH_DIR"
}

# Wait for a pattern to appear in a tmux pane's visible output
wait_for() {
  local pane=$1 pattern=$2 timeout=${3:-30} i=0
  while ! tmux capture-pane -p -t "$pane" 2>/dev/null | grep -q "$pattern"; do
    sleep 0.5
    i=$((i + 1))
    if [ $i -ge $((timeout * 2)) ]; then
      echo "TIMEOUT waiting for '$pattern' in $pane" >&2
      return 1
    fi
  done
  sleep 0.5
}

bob()   { tmux send-keys -t "$SESSION:0.0" "$@"; }
alice() { tmux send-keys -t "$SESSION:0.1" "$@"; }
pause() { sleep "${1:-1.5}"; }

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

setup() {
  cleanup

  tmux new-session -d -s "$SESSION" -x 160 -y 40
  tmux split-window -h -t "$SESSION"

  # Cosmetics
  tmux set -t "$SESSION" status off
  tmux setw -t "$SESSION" pane-border-style "fg=8"
  tmux setw -t "$SESSION" pane-active-border-style "fg=12"

  # Bob (left pane)
  bob "export PS1='$ ' TRESH_DIR=$TRESH_DIR TRESH_ID=bob" Enter
  pause 0.3
  bob "tresh() { $TRESH_CMD \"\$@\"; }; export -f tresh" Enter
  pause 0.3
  bob "clear" Enter

  # Alice (right pane)
  alice "export PS1='$ ' TRESH_DIR=$TRESH_DIR TRESH_ID=alice" Enter
  pause 0.3
  alice "tresh() { $TRESH_CMD \"\$@\"; }; export -f tresh" Enter
  pause 0.3
  alice "clear" Enter

  pause 1
}

# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------

demo() {
  # ===== PHASE 1: Push mode =====

  bob "tresh watch --push" Enter
  pause 1.5

  alice "tresh send bob 'ping from alice'" Enter
  pause 2

  alice "tresh send bob 'ready to pair?'" Enter
  pause 2

  bob C-c
  pause 0.5

  # ===== PHASE 2: Poll mode =====

  alice "tresh watch --poll 2000" Enter
  pause 1.5

  bob "tresh send alice 'yep, spinning up claude'" Enter
  pause 4  # wait for poll interval to fire

  alice C-c
  pause 0.5

  # ===== PHASE 3: Real Claude Code =====

  bob "claude --dangerously-skip-permissions" Enter
  wait_for "$SESSION:0.0" "^>" 20

  alice "claude --dangerously-skip-permissions" Enter
  wait_for "$SESSION:0.1" "^>" 20

  bob "! tresh send alice 'found bug in auth.ts:42'" Enter
  pause 3

  alice "! tresh inbox" Enter
  pause 2

  alice "! tresh send bob 'fix looks good, ship it'" Enter
  pause 3

  bob "! tresh inbox" Enter
  pause 2

  # ===== PHASE 4: Exit & goodbye =====

  bob "/exit" Enter
  pause 2

  alice "/exit" Enter
  pause 2

  bob "tresh send alice 'good sesh, later'" Enter
  pause 2

  alice "tresh inbox" Enter
  pause 1.5

  alice "tresh send bob 'o/'" Enter
  pause 3
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

setup

case "${1:-}" in
  --record)
    CAST="/tmp/tresh-demo.cast"
    echo "Recording to $CAST..."

    # Record in background (read-only attach)
    asciinema rec "$CAST" --cols 160 --rows 40 --overwrite \
      -c "tmux attach -t $SESSION -r" &
    REC_PID=$!
    sleep 2

    demo

    # End recording by killing session (disconnects the attach)
    tmux kill-session -t "$SESSION" 2>/dev/null || true
    wait $REC_PID 2>/dev/null || true

    # Convert to GIF
    echo "Converting to GIF..."
    agg --font-size 14 --theme monokai "$CAST" assets/demo-split-raw.gif
    gifsicle -O3 --lossy=30 --colors 128 assets/demo-split-raw.gif -o assets/demo-split.gif
    rm -f assets/demo-split-raw.gif "$CAST"

    # Preview thumbnail
    FRAMES=$(ffprobe -v quiet -count_frames -show_entries stream=nb_read_frames -of csv=p=0 assets/demo-split.gif 2>/dev/null || echo "1")
    LAST=$((FRAMES - 1))
    ffmpeg -y -i assets/demo-split.gif -vf "select='eq(n,$LAST)',scale=300:-1" \
      -frames:v 1 assets/demo-split-preview.png 2>/dev/null || true

    echo "Done: assets/demo-split.gif ($(du -h assets/demo-split.gif | cut -f1))"
    rm -rf "$TRESH_DIR"
    ;;
  *)
    echo "Demo ready. Attach with:"
    echo "  tmux attach -t $SESSION"
    echo ""
    echo "Press Enter to start the demo..."
    read -r
    demo
    echo ""
    echo "Demo complete. Kill: tmux kill-session -t $SESSION"
    ;;
esac
