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

# tmux attach needs a real terminal -- bail if there isn't one
if [ "${1:-}" = "--record" ] && ! tty -s; then
  echo "ERROR: --record requires a real terminal (tmux attach needs a TTY)."
  echo ""
  echo "Run this from your Ghostty terminal:"
  echo "  cd $(pwd) && ./scripts/demo-split.sh --record"
  exit 1
fi

SESSION="tresh-demo"
TRESH_DIR="/tmp/tresh-demo-real"
TRESH_CMD="bun run $(pwd)/src/cli.ts"
SCRIPT_PATH="$PATH"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

cleanup() {
  tmux kill-session -t "$SESSION" 2>/dev/null || true
  rm -rf "$TRESH_DIR"
}

# Wait for a pattern in a pane. Non-fatal on timeout (demo continues).
wait_for() {
  local pane=$1 pattern=$2 timeout=${3:-30} i=0
  while ! tmux capture-pane -p -t "$pane" 2>/dev/null | grep -qE "$pattern"; do
    sleep 0.5
    i=$((i + 1))
    if [ $i -ge $((timeout * 2)) ]; then
      echo "  (wait_for timeout -- continuing)" >&2
      return 0
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

  TMUX= tmux new-session -d -s "$SESSION" -x 160 -y 40
  TMUX= tmux split-window -h -t "$SESSION"

  # Cosmetics
  tmux set -t "$SESSION" status off
  tmux setw -t "$SESSION" pane-border-style "fg=colour240"
  tmux setw -t "$SESSION" pane-active-border-style "fg=colour75"

  # Bob (left pane) -- export PATH so claude is findable
  bob "export PS1='$ ' TRESH_DIR=$TRESH_DIR TRESH_ID=bob PATH='$SCRIPT_PATH'" Enter
  pause 0.3
  bob "tresh() { $TRESH_CMD \"\$@\"; }; export -f tresh" Enter
  pause 0.3
  bob "clear" Enter

  # Alice (right pane)
  alice "export PS1='$ ' TRESH_DIR=$TRESH_DIR TRESH_ID=alice PATH='$SCRIPT_PATH'" Enter
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
  wait_for "$SESSION:0.0" ">" 20

  alice "claude --dangerously-skip-permissions" Enter
  wait_for "$SESSION:0.1" ">" 20

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
    echo "The demo will play in your terminal."
    echo ""

    # Run demo in background, kill session when done
    (
      sleep 3  # let asciinema attach first
      demo
      sleep 1
      tmux kill-session -t "$SESSION" 2>/dev/null || true
    ) &
    BG_PID=$!

    # Record in foreground (needs TTY for tmux attach)
    TMUX= asciinema rec "$CAST" --cols 160 --rows 40 --overwrite \
      -c "TMUX= tmux attach -t $SESSION -r" || true

    wait $BG_PID 2>/dev/null || true

    # Convert to GIF
    echo ""
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
