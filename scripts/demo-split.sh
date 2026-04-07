#!/usr/bin/env bash
# tmesh split-pane demo — two agents communicating in real-time
# Left pane: bob watches (push mode)
# Right pane: alice sends messages
#
# Usage: ./scripts/demo-split.sh
# To record: ./scripts/demo-split.sh --record

set -euo pipefail
cd "$(dirname "$0")/.."

SESSION="tmesh-demo"
RECORD="${1:-}"

# Clean up any previous demo
tmux kill-session -t "$SESSION" 2>/dev/null || true
rm -rf ~/.tmesh/bob ~/.tmesh/alice 2>/dev/null || true

# Create session with bob (left pane)
tmux new-session -d -s "$SESSION" -x 200 -y 50

# Bob: identify and watch (push mode)
tmux send-keys -t "$SESSION" "export TMESH_IDENTITY=bob" Enter
sleep 0.5
tmux send-keys -t "$SESSION" "echo '--- bob watching (push mode) ---'" Enter
sleep 0.3
tmux send-keys -t "$SESSION" "bun run src/cli.ts watch --push" Enter
sleep 1

# Split right pane for alice
tmux split-window -h -t "$SESSION"
sleep 0.5

# Alice: identify
tmux send-keys -t "$SESSION" "export TMESH_IDENTITY=alice" Enter
sleep 0.5
tmux send-keys -t "$SESSION" "echo '--- alice sending ---'" Enter
sleep 1

# Alice sends messages (bob receives in real-time via push)
tmux send-keys -t "$SESSION" "bun run src/cli.ts send bob 'hello from alice'" Enter
sleep 2

tmux send-keys -t "$SESSION" "bun run src/cli.ts send bob 'can you review PR 42?'" Enter
sleep 2

tmux send-keys -t "$SESSION" "bun run src/cli.ts send bob 'tests pass -- shipping it'" Enter
sleep 2

# Alice checks who's on the mesh
tmux send-keys -t "$SESSION" "bun run src/cli.ts ls" Enter
sleep 2

if [ "$RECORD" = "--record" ]; then
    echo "Demo running in session '$SESSION'. Attach with: tmux attach -t $SESSION"
    echo "Record with your screen recorder, then kill with: tmux kill-session -t $SESSION"
else
    # Attach for interactive viewing
    tmux attach -t "$SESSION"
fi
