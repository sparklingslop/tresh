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

# tmux attach needs a real terminal
if [ "${1:-}" = "--record" ] && ! tty -s; then
  echo "ERROR: --record requires a real terminal (tmux attach needs a TTY)."
  echo ""
  echo "Run from Ghostty:"
  echo "  cd $(pwd) && ./scripts/demo-split.sh --record"
  exit 1
fi

SESSION="tresh-demo"
TRESH_DIR="/tmp/tresh-demo-real"
TRESH_BIN="/tmp/tresh-demo-bin"
REPO="$(pwd)"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

cleanup() {
  tmux kill-session -t "$SESSION" 2>/dev/null || true
  rm -rf "$TRESH_DIR" "$TRESH_BIN" /tmp/tresh-pane-*.rc
}

# Wait for text in a pane. Non-fatal, silent on timeout.
wait_for() {
  local pane=$1 pattern=$2 timeout=${3:-15} i=0
  while ! tmux capture-pane -p -t "$pane" 2>/dev/null | grep -qE "$pattern"; do
    sleep 0.5
    i=$((i + 1))
    [ $i -ge $((timeout * 2)) ] && return 0
  done
  sleep 0.5
}

bob()   { tmux send-keys -t "$SESSION:0.0" "$@"; }
alice() { tmux send-keys -t "$SESSION:0.1" "$@"; }
pause() { sleep "${1:-1.5}"; }

# ---------------------------------------------------------------------------
# Setup -- completely invisible to the viewer
# ---------------------------------------------------------------------------

setup() {
  cleanup

  # Create a real tresh binary (functions don't survive into Claude's ! shell)
  mkdir -p "$TRESH_BIN"
  cat > "$TRESH_BIN/tresh" << BINEOF
#!/bin/bash
exec bun run $REPO/src/cli.ts "\$@"
BINEOF
  chmod +x "$TRESH_BIN/tresh"

  # Write per-pane rc files
  for name in bob alice; do
    cat > "/tmp/tresh-pane-${name}.rc" << RCEOF
export PS1='\$ '
export TRESH_DIR=$TRESH_DIR
export TRESH_ID=$name
export PATH="$TRESH_BIN:$PATH"
RCEOF
  done

  TMUX= tmux new-session -d -s "$SESSION"
  TMUX= tmux split-window -h -t "$SESSION"

  # Cosmetics
  tmux set -t "$SESSION" status off
  tmux setw -t "$SESSION" pane-border-style "fg=colour240"
  tmux setw -t "$SESSION" pane-active-border-style "fg=colour75"

  # Start clean bash with env pre-loaded (nothing visible)
  tmux respawn-pane -k -t "$SESSION:0.0" "bash --rcfile /tmp/tresh-pane-bob.rc --noprofile"
  tmux respawn-pane -k -t "$SESSION:0.1" "bash --rcfile /tmp/tresh-pane-alice.rc --noprofile"

  sleep 1
}

# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------

demo() {
  # ===== PHASE 1: Push mode (bob watches, alice sends -- instant) =====

  bob "tresh watch --push" Enter
  pause 2

  alice "tresh send bob 'hey, you around?'" Enter
  pause 2.5

  alice "tresh send bob 'ready to pair on the auth bug?'" Enter
  pause 2.5

  alice "tresh send bob 'push is instant btw'" Enter
  pause 2.5

  bob C-c
  pause 1

  # ===== PHASE 2: Poll mode (alice watches, bob sends -- 2s interval) =====

  alice "tresh watch --poll 2000" Enter
  pause 2

  bob "tresh send alice 'yeah, give me a sec'" Enter
  pause 4

  bob "tresh send alice 'spinning up claude now'" Enter
  pause 4

  alice C-c
  pause 1

  # ===== PHASE 3: Real Claude Code =====

  # Bob launches -- wait for "bypass permissions" in status bar
  bob "claude --dangerously-skip-permissions" Enter
  wait_for "$SESSION:0.0" "bypass" 15
  pause 2

  # Alice launches
  alice "claude --dangerously-skip-permissions" Enter
  wait_for "$SESSION:0.1" "bypass" 15
  pause 2

  # -- Poll demo inside Claude Code --
  # Bob sends, alice reads via inbox (one-shot poll)
  bob "! tresh send alice 'found it -- auth.ts line 42, token not refreshed'" Enter
  pause 6

  alice "! tresh inbox" Enter
  pause 6

  alice "! tresh send bob 'nice catch, writing the test now'" Enter
  pause 6

  # -- Push demo inside Claude Code (the differentiator!) --
  # Bob starts watching with push (timeout so it auto-exits)
  bob "! timeout 10 tresh watch --push" Enter
  pause 3  # let watch start and show "watching..."

  # Alice sends -- bob receives INSTANTLY via push, no polling needed
  alice "! tresh send bob 'test written, all green, ship it'" Enter
  pause 10  # wait for bob's timeout to expire

  # ===== PHASE 4: Exit & goodbye =====

  bob "/exit" Enter
  pause 3

  alice "/exit" Enter
  pause 3

  bob "tresh send alice 'good sesh, later'" Enter
  pause 2.5

  alice "tresh inbox" Enter
  pause 2

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

    (
      sleep 3
      demo
      sleep 2
      tmux kill-session -t "$SESSION" 2>/dev/null || true
    ) &
    BG_PID=$!

    TMUX= asciinema rec "$CAST" --overwrite \
      -c "TMUX= tmux attach -t $SESSION" || true

    wait $BG_PID 2>/dev/null || true

    echo ""
    echo "Converting to GIF..."
    agg --font-size 14 --theme monokai "$CAST" assets/demo-split-raw.gif
    gifsicle -O3 --lossy=30 --colors 128 assets/demo-split-raw.gif -o assets/demo-split.gif
    rm -f assets/demo-split-raw.gif "$CAST"

    FRAMES=$(ffprobe -v quiet -count_frames -show_entries stream=nb_read_frames -of csv=p=0 assets/demo-split.gif 2>/dev/null || echo "4")
    TARGET=$(( FRAMES * 3 / 4 ))
    ffmpeg -y -i assets/demo-split.gif -vf "select='eq(n,$TARGET)',scale=300:-1" \
      -frames:v 1 assets/demo-split-preview.png 2>/dev/null || true

    SIZE=$(du -h assets/demo-split.gif | cut -f1)
    echo "Done: assets/demo-split.gif ($SIZE, $FRAMES frames)"
    cleanup
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
