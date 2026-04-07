#!/usr/bin/env bash
# Run the split-pane demo and capture both panes for display.
# Designed to be called from VHS or directly.
set -euo pipefail
cd "$(dirname "$0")/.."

SESSION="tresh-demo-$$"
TRESH_CMD="bun run $(pwd)/src/cli.ts"

# Clean slate
tmux kill-session -t "$SESSION" 2>/dev/null || true
rm -rf ~/.tresh/bob ~/.tresh/alice 2>/dev/null || true

# Create session: bob in left pane (wide enough for clean output)
tmux new-session -d -s "$SESSION" -x 120 -y 24

# Bob: alias + identify + watch
tmux send-keys -t "$SESSION:0.0" "alias tresh='$TRESH_CMD'" Enter
sleep 0.2
tmux send-keys -t "$SESSION:0.0" "export TRESH_ID=bob" Enter
sleep 0.2
tmux send-keys -t "$SESSION:0.0" "clear" Enter
sleep 0.2
tmux send-keys -t "$SESSION:0.0" "tresh watch --push" Enter
sleep 1

# Split: alice in right pane
tmux split-window -h -t "$SESSION"
sleep 0.3
tmux send-keys -t "$SESSION:0.1" "alias tresh='$TRESH_CMD'" Enter
sleep 0.2
tmux send-keys -t "$SESSION:0.1" "export TRESH_ID=alice" Enter
sleep 0.2
tmux send-keys -t "$SESSION:0.1" "clear" Enter
sleep 0.3

# Alice sends messages
tmux send-keys -t "$SESSION:0.1" "tresh send bob 'hello from alice'" Enter
sleep 1.5
tmux send-keys -t "$SESSION:0.1" "tresh send bob 'review PR 42?'" Enter
sleep 1.5
tmux send-keys -t "$SESSION:0.1" "tresh send bob 'tests pass, ship it'" Enter
sleep 2

# Alice checks who's online
tmux send-keys -t "$SESSION:0.1" "tresh ls" Enter
sleep 1.5

# Capture both panes
LEFT=$(tmux capture-pane -t "$SESSION:0.0" -p 2>/dev/null || echo "(capture failed)")
RIGHT=$(tmux capture-pane -t "$SESSION:0.1" -p 2>/dev/null || echo "(capture failed)")

# Kill session
tmux kill-session -t "$SESSION" 2>/dev/null || true

# Display side by side
COL=50
echo ""
printf "  %-${COL}s   %s\n" "bob (push watch)" "alice (sender)"
printf "  %-${COL}s   %s\n" "$(printf '%0.s-' {1..46})" "$(printf '%0.s-' {1..46})"
paste <(echo "$LEFT" | head -16) <(echo "$RIGHT" | head -16) | while IFS=$'\t' read -r l r; do
  printf "  %-${COL}s | %s\n" "$l" "$r"
done
echo ""
