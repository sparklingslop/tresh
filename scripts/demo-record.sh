#!/usr/bin/env bash
# Record the split-pane tresh demo as an asciinema cast, then convert to GIF.
# Usage: ./scripts/demo-record.sh
#
# Left pane: bob watches (push mode)
# Right pane: alice sends messages
# Result: assets/demo-split.gif

set -euo pipefail
cd "$(dirname "$0")/.."

SESSION="tresh-demo"
CAST="/tmp/tresh-demo.cast"
TRESH="bun run $(pwd)/src/cli.ts"

# Clean up previous
tmux kill-session -t "$SESSION" 2>/dev/null || true
rm -rf ~/.tresh/bob ~/.tresh/alice "$CAST" 2>/dev/null || true

echo "Recording tresh split-pane demo..."

# Record with asciinema — run the demo script inside
asciinema rec "$CAST" --cols 120 --rows 30 --overwrite -c "bash -c '
  SESSION=\"$SESSION\"
  TRESH=\"$TRESH\"

  # Create tmux session with bob in left pane
  tmux new-session -d -s \$SESSION -x 120 -y 30
  tmux send-keys -t \$SESSION \"export TRESH_ID=bob\" Enter
  sleep 0.5
  tmux send-keys -t \$SESSION \"echo \\\"--- bob watching (push mode) ---\\\"\" Enter
  sleep 0.3
  tmux send-keys -t \$SESSION \"\$TRESH watch --push\" Enter
  sleep 1

  # Split right pane for alice
  tmux split-window -h -t \$SESSION
  sleep 0.5
  tmux send-keys -t \$SESSION \"export TRESH_ID=alice\" Enter
  sleep 0.5
  tmux send-keys -t \$SESSION \"echo \\\"--- alice sending ---\\\"\" Enter
  sleep 1

  # Alice sends messages
  tmux send-keys -t \$SESSION \"\$TRESH send bob hello from alice\" Enter
  sleep 2
  tmux send-keys -t \$SESSION \"\$TRESH send bob can you review PR 42?\" Enter
  sleep 2
  tmux send-keys -t \$SESSION \"\$TRESH send bob tests pass, shipping it\" Enter
  sleep 2

  # Alice lists nodes
  tmux send-keys -t \$SESSION \"\$TRESH ls\" Enter
  sleep 2

  # Attach briefly to capture the final state
  tmux attach -t \$SESSION -r &
  TMUX_PID=\$!
  sleep 3
  kill \$TMUX_PID 2>/dev/null || true
  tmux kill-session -t \$SESSION 2>/dev/null || true
'"

echo "Converting to GIF..."
agg --theme monokai "$CAST" assets/demo-split-raw.gif
gifsicle -O3 --lossy=30 --colors 128 assets/demo-split-raw.gif -o assets/demo-split.gif
rm -f assets/demo-split-raw.gif "$CAST"

echo "Done: assets/demo-split.gif ($(du -h assets/demo-split.gif | cut -f1))"
