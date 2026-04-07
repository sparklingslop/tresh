#!/usr/bin/env bash
# tresh full demo -- real Claude Code, push + poll modes
#
# Two tmux panes. Bob (left) and Alice (right).
# Phase 1: True push -- background watcher, messages appear automatically
# Phase 2: Poll comparison -- alice watches with --poll, visible delay
# Phase 3: Real Claude Code -- both launch, chat via ! tresh, /exit
# Phase 4: Terminal goodbye -- push watchers auto-restart
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
# Setup
# ---------------------------------------------------------------------------

setup() {
  cleanup

  # Create real tresh binary on PATH
  mkdir -p "$TRESH_BIN"
  cat > "$TRESH_BIN/tresh" << BINEOF
#!/bin/bash
exec bun run $REPO/src/cli.ts "\$@"
BINEOF
  chmod +x "$TRESH_BIN/tresh"

  # Per-pane rcfiles: export identity + register pane TTY for true push
  for name in bob alice; do
    cat > "/tmp/tresh-pane-${name}.rc" << RCEOF
export PS1='\$ '
export TRESH_DIR=$TRESH_DIR
export TRESH_ID=$name
export PATH="$TRESH_BIN:$PATH"
tresh identify $name >/dev/null
RCEOF
  done

  TMUX= tmux new-session -d -s "$SESSION"
  TMUX= tmux split-window -h -t "$SESSION"

  tmux set -t "$SESSION" status off
  tmux setw -t "$SESSION" pane-border-style "fg=colour240"
  tmux setw -t "$SESSION" pane-active-border-style "fg=colour75"

  tmux respawn-pane -k -t "$SESSION:0.0" "bash --rcfile /tmp/tresh-pane-bob.rc --noprofile"
  tmux respawn-pane -k -t "$SESSION:0.1" "bash --rcfile /tmp/tresh-pane-alice.rc --noprofile"

  sleep 2  # let watchers start
}

# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------

demo() {
  # ===== PHASE 1: True push -- no watcher, messages appear on the pane =====
  # send() writes directly to the target's pane TTY. No process needed.

  alice "tresh send bob 'hey, you around?'" Enter
  pause 2.5

  bob "tresh send alice 'yeah, on the auth bug'" Enter
  pause 2.5

  alice "tresh send bob 'push delivers to your terminal directly'" Enter
  pause 2.5

  bob "tresh send alice 'no watcher, no polling, no background process'" Enter
  pause 2.5

  # ===== PHASE 2: Poll comparison -- visible delay =====

  alice "tresh watch --poll 2000" Enter
  pause 2

  bob "tresh send alice 'this one takes up to 2 seconds'" Enter
  pause 4

  alice C-c
  pause 1

  bob "tresh send alice 'spinning up claude now'" Enter
  pause 2.5

  # ===== PHASE 3: Real Claude Code =====

  bob "claude --dangerously-skip-permissions" Enter
  wait_for "$SESSION:0.0" "bypass" 15
  pause 2

  alice "claude --dangerously-skip-permissions" Enter
  wait_for "$SESSION:0.1" "bypass" 15
  pause 2

  # True push works inside Claude Code too -- send writes to pane TTY
  bob "! tresh send alice 'found it -- auth.ts line 42, token not refreshed'" Enter
  pause 6

  alice "! tresh send bob 'nice catch, writing the test now'" Enter
  pause 6

  bob "! tresh send alice 'fix pushed, your turn'" Enter
  pause 6

  alice "! tresh send bob 'test written, all green, ship it'" Enter
  pause 6

  # ===== PHASE 4: Exit Claude Code -- wait for actual exit =====

  bob "/exit" Enter
  wait_for "$SESSION:0.0" '^\$' 15
  pause 1

  alice "/exit" Enter
  wait_for "$SESSION:0.1" '^\$' 15
  pause 1

  # ===== PHASE 5: Terminal goodbye =====

  bob "tresh send alice 'good sesh, later'" Enter
  pause 2.5

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
