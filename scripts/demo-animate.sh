#!/usr/bin/env bash
# Animated split-pane demo: sets up tmux in background, captures panes on screen.
# VHS records this script's output (no tmux attach needed).
set -euo pipefail
cd "$(dirname "$0")/.."

SESSION="tresh-demo-$$"
TRESH_CMD="bun run $(pwd)/src/cli.ts"
W=52  # column width per pane

# Clean slate
tmux kill-session -t "$SESSION" 2>/dev/null || true
rm -rf ~/.tresh/bob ~/.tresh/alice 2>/dev/null || true

# Helper: capture and display both panes side by side
show() {
  local left right
  left=$(tmux capture-pane -t "$SESSION:0.0" -p 2>/dev/null | head -18)
  right=$(tmux capture-pane -t "$SESSION:0.1" -p 2>/dev/null | head -18)

  clear
  printf "\033[1m  %-${W}s  %s\033[0m\n" "bob (watching --push)" "alice (sending)"
  printf "  \033[2m%-${W}s  %s\033[0m\n" "$(printf '%.0s-' $(seq 1 $W))" "$(printf '%.0s-' $(seq 1 $W))"

  paste <(echo "$left") <(echo "$right") | while IFS=$'\t' read -r l r; do
    printf "  %-${W}s  %s\n" "$l" "$r"
  done
}

# Set up tmux session (wide so panes don't wrap)
tmux new-session -d -s "$SESSION" -x 200 -y 20

# Bob: left pane
tmux send-keys -t "$SESSION:0.0" "alias tresh='$TRESH_CMD'" Enter
sleep 0.3
tmux send-keys -t "$SESSION:0.0" "export TRESH_ID=bob" Enter
sleep 0.3
tmux send-keys -t "$SESSION:0.0" "clear" Enter
sleep 0.3
tmux send-keys -t "$SESSION:0.0" "tresh watch --push" Enter
sleep 1

# Alice: right pane
tmux split-window -h -t "$SESSION"
sleep 0.5
tmux send-keys -t "$SESSION:0.1" "alias tresh='$TRESH_CMD'" Enter
sleep 0.3
tmux send-keys -t "$SESSION:0.1" "export TRESH_ID=alice" Enter
sleep 0.3
tmux send-keys -t "$SESSION:0.1" "clear" Enter
sleep 0.5

# Show initial state
show
sleep 2

# Alice sends messages -- capture after each
tmux send-keys -t "$SESSION:0.1" "tresh send bob 'hello from alice'" Enter
sleep 1.5
show
sleep 2

tmux send-keys -t "$SESSION:0.1" "tresh send bob 'review PR 42?'" Enter
sleep 1.5
show
sleep 2

tmux send-keys -t "$SESSION:0.1" "tresh send bob 'tests pass, ship it'" Enter
sleep 1.5
show
sleep 2

# Alice lists nodes
tmux send-keys -t "$SESSION:0.1" "tresh ls" Enter
sleep 1.5
show
sleep 3

# Cleanup
tmux kill-session -t "$SESSION" 2>/dev/null || true
