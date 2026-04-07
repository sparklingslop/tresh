#!/usr/bin/env bash
# tresh full demo -- real Claude Code, push + poll modes
#
# Clones tresh fresh from GitHub into ~/Code/demos/tresh, then runs
# the demo in a clean environment. Two tmux panes: bob (left), alice (right).
#
# Phase 1: True push -- messages appear instantly on the target's terminal
# Phase 2: Poll comparison -- visible 2s delay vs instant push
# Phase 3: Synchronized Claude Code launch with countdown
# Phase 4: Three CC interaction modes (shell escape, Bash tool, natural language)
# Phase 5: Exit and goodbye
#
# Usage:
#   ./scripts/demo-split.sh              # run demo, attach to watch
#   ./scripts/demo-split.sh --record     # record with asciinema -> GIF

set -euo pipefail

# tmux attach needs a real terminal
if [ "${1:-}" = "--record" ] && ! tty -s; then
  echo "ERROR: --record requires a real terminal (tmux attach needs a TTY)."
  echo ""
  echo "Run from Ghostty:"
  echo "  ./scripts/demo-split.sh --record"
  exit 1
fi

SESSION="tresh-demo"
DEMO_BASE="$HOME/Code/demos"
DEMO_DIR="$DEMO_BASE/tresh"
TRESH_DIR="/tmp/tresh-demo-real"
TRESH_BIN="/tmp/tresh-demo-bin"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT_REPO="$(cd "$SCRIPT_DIR/.." && pwd)"

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
    [ $i -ge $((timeout * 2)) ] && return 1
  done
  sleep 0.5
  return 0
}

# Wait for CC to be ready, handling optional trust prompt
wait_cc_ready() {
  local pane=$1 timeout=${2:-30} i=0
  while true; do
    local screen
    screen=$(tmux capture-pane -p -t "$pane" 2>/dev/null || echo "")
    # Already past trust prompt -- CC is ready
    if echo "$screen" | grep -qE "bypass"; then
      sleep 0.5
      return 0
    fi
    # Trust prompt showing -- confirm it
    if echo "$screen" | grep -q "Yes, I trust this folder"; then
      tmux send-keys -t "$pane" Enter
      wait_for "$pane" "bypass" 30
      return 0
    fi
    sleep 0.5
    i=$((i + 1))
    [ $i -ge $((timeout * 2)) ] && return 1
  done
}

bob()   { tmux send-keys -t "$SESSION:0.0" "$@"; }
alice() { tmux send-keys -t "$SESSION:0.1" "$@"; }
pause() { sleep "${1:-1.5}"; }

# ---------------------------------------------------------------------------
# Setup -- fresh clone, clean environment
# ---------------------------------------------------------------------------

setup() {
  cleanup

  # Fresh clone from GitHub
  # SAFETY: 3 independent checks before deleting. Accidentally deleting
  # the source repo or anything above ~/Code/demos/ would be fatal.
  mkdir -p "$DEMO_BASE"
  if [ -d "$DEMO_DIR" ]; then
    safe_to_delete=true

    # CHECK 1: Path must end with exactly /demos/tresh
    case "$DEMO_DIR" in
      */demos/tresh) ;;
      *) echo "SAFETY CHECK 1 FAILED: path does not end in /demos/tresh: $DEMO_DIR"; safe_to_delete=false ;;
    esac

    # CHECK 2: Path must be exactly ~/Code/demos/tresh (no symlink tricks, no ..)
    resolved_dir="$(cd "$DEMO_DIR" && pwd -P)"
    expected_dir="$HOME/Code/demos/tresh"
    if [ "$resolved_dir" != "$expected_dir" ]; then
      echo "SAFETY CHECK 2 FAILED: resolved path $resolved_dir != expected $expected_dir"
      safe_to_delete=false
    fi

    # CHECK 3: Must contain a .git dir with sparklingslop/tresh remote (it's our clone, not something else)
    if [ -d "$DEMO_DIR/.git" ]; then
      remote_url="$(git -C "$DEMO_DIR" remote get-url origin 2>/dev/null || echo "")"
      case "$remote_url" in
        *sparklingslop/tresh*) ;;
        *) echo "SAFETY CHECK 3 FAILED: git remote is '$remote_url', not sparklingslop/tresh"; safe_to_delete=false ;;
      esac
    else
      echo "SAFETY CHECK 3 FAILED: $DEMO_DIR/.git does not exist (not a git clone)"
      safe_to_delete=false
    fi

    if [ "$safe_to_delete" = true ]; then
      rm -rf "$DEMO_DIR"
    else
      echo "ABORTING: refusing to delete $DEMO_DIR"
      exit 1
    fi
  fi
  echo "Cloning tresh from GitHub..."
  git clone --quiet https://github.com/sparklingslop/tresh.git "$DEMO_DIR"
  (cd "$DEMO_DIR" && bun install --silent)
  echo "Clone ready at $DEMO_DIR"

  # Create real tresh binary pointing to the clone
  mkdir -p "$TRESH_BIN"
  cat > "$TRESH_BIN/tresh" << BINEOF
#!/bin/bash
exec bun run $DEMO_DIR/src/cli.ts "\$@"
BINEOF
  chmod +x "$TRESH_BIN/tresh"

  # Per-pane rcfiles: clean env, cd into clone, register identity
  for name in bob alice; do
    cat > "/tmp/tresh-pane-${name}.rc" << RCEOF
export PS1='\$ '
export TRESH_DIR=$TRESH_DIR
export TRESH_ID=$name
export PATH="$TRESH_BIN:$PATH"
export CONTEXT_ROTATE_DISABLE=1
cd $DEMO_DIR
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

  sleep 2
}

# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------

demo() {
  # ===== PHASE 1: True push (~15s) =====
  # send() writes directly to the target's pane TTY. No watcher, no polling,
  # no background process. Messages just appear.

  alice "tresh send bob 'hey, you around?'" Enter
  pause 2.5

  bob "tresh send alice 'yeah, on the auth bug'" Enter
  pause 2.5

  alice "tresh send bob 'push delivers to your terminal directly'" Enter
  pause 2.5

  bob "tresh send alice 'no watcher, no polling, no background process'" Enter
  pause 2.5

  # ===== PHASE 2: Poll comparison (~7s) =====
  # Contrast: poll mode has visible delay vs instant push

  alice "tresh watch --poll 2000" Enter
  pause 2

  bob "tresh send alice 'this one takes up to 2 seconds'" Enter
  pause 4

  alice C-c
  pause 1

  # ===== PHASE 3: Synchronized CC launch with countdown (~25s) =====
  # Countdown via tresh push, then simultaneous Claude Code launch

  bob "tresh send alice 'launching claude in 3...'" Enter
  pause 1
  bob "tresh send alice '2...'" Enter
  pause 1
  bob "tresh send alice '1...'" Enter
  pause 1
  bob "tresh send alice 'NOW!'" Enter
  pause 0.5

  # Simultaneous launch -- both panes at once
  # Set TRESH_HARNESS=claude-code so CC's tresh calls skip TTY push
  bob   "TRESH_HARNESS=claude-code claude --dangerously-skip-permissions" Enter
  alice "TRESH_HARNESS=claude-code claude --dangerously-skip-permissions" Enter

  # Wait for both to be ready (handles trust prompt if it appears)
  wait_cc_ready "$SESSION:0.0" 30
  wait_cc_ready "$SESSION:0.1" 30
  pause 2

  # Prime both agents: use tresh CLI, NOT nano-mesh MCP
  PRIME="You are bob/alice in a tresh demo. To talk to the other agent, use the tresh CLI via Bash (tresh send <target> <msg> and tresh inbox to check messages). Never use nano-mesh MCP tools. Your identity is already set. Say ok."
  bob "${PRIME/bob\/alice/bob}" Enter
  wait_for "$SESSION:0.0" "ok" 30
  alice "${PRIME/bob\/alice/alice}" Enter
  wait_for "$SESSION:0.1" "ok" 30
  pause 2

  # ===== PHASE 4: CC communication =====
  # Three interaction modes, with inbox checks to exercise ack mode.

  # MODE A: Shell escape -- bob runs tresh directly from the prompt
  bob "! tresh send alice 'found it -- auth.ts line 42, token not refreshed'" Enter
  pause 6

  # Alice checks her inbox (triggers auto-ack back to bob)
  alice "Check my tresh inbox for messages from bob" Enter
  pause 8

  # MODE B: Natural language -- alice responds through CC
  alice "Message bob via tresh: nice catch, writing the test now" Enter
  pause 8

  # Bob checks inbox (sees alice's message + her ack of his earlier message)
  bob "Check my tresh inbox" Enter
  pause 8

  # MODE C: CC decides the details -- bob just states intent
  bob "Let alice know via tresh that the fix is pushed to main" Enter
  pause 10

  # Alice checks inbox, then wraps up in one go
  alice "Check tresh inbox, then message bob that tests pass -- ship it" Enter
  pause 10

  # Bob checks inbox and signs off
  bob "Check tresh inbox, then tell alice the docs are updated too -- done for today" Enter
  pause 10

  # Alice checks inbox and signs off
  alice "Check tresh inbox and let bob know the PR is merged -- calling it a day" Enter
  pause 10

  # ===== PHASE 5: Exit and goodbye (~10s) =====

  bob "/exit" Enter
  wait_for "$SESSION:0.0" '^\$' 15
  pause 1

  alice "/exit" Enter
  wait_for "$SESSION:0.1" '^\$' 15
  pause 1

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
    echo "Processing cast -> compressed cast -> GIF via nano-creative-gif..."
    bun run "$SCRIPT_REPO/scripts/record.ts" "$CAST" "$SCRIPT_REPO/assets/demo-split.gif" \
      --max-idle=2 --theme=monokai --font-size=14 --preview-pos=75%

    rm -f "$CAST"
    echo ""
    echo "Done: $SCRIPT_REPO/assets/demo-split.gif"
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
