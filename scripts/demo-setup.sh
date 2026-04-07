#!/usr/bin/env bash
# Set up the split-pane demo session (run BEFORE VHS recording).
set -euo pipefail
cd "$(dirname "$0")/.."

TRESH_CMD="bun run $(pwd)/src/cli.ts"

# Clean slate
tmux kill-session -t demo 2>/dev/null || true
rm -rf ~/.tresh/bob ~/.tresh/alice 2>/dev/null || true

# Create session
tmux new-session -d -s demo -x 110 -y 24

# Bob: left pane — alias + identify + watch
tmux send-keys -t demo:0.0 "alias tresh='$TRESH_CMD'" Enter
sleep 0.3
tmux send-keys -t demo:0.0 "export TRESH_ID=bob" Enter
sleep 0.3
tmux send-keys -t demo:0.0 "clear && tresh watch --push" Enter
sleep 1

# Alice: right pane — alias + identify + clear
tmux split-window -h -t demo
sleep 0.5
tmux send-keys -t demo:0.1 "alias tresh='$TRESH_CMD'" Enter
sleep 0.3
tmux send-keys -t demo:0.1 "export TRESH_ID=alice" Enter
sleep 0.3
tmux send-keys -t demo:0.1 "clear" Enter
sleep 0.3

echo "Demo session ready. Attach with: tmux attach -t demo"
