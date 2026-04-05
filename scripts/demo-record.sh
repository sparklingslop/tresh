#!/usr/bin/env bash
# Orchestrates the tmesh demo inside a tmux session.
# Called by demo.tape -- runs inside the vhs-spawned terminal.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEMO_HOME="/tmp/tmesh-demo"

# Seed state
bash "$REPO_DIR/scripts/demo-setup.sh" "$DEMO_HOME"

# Create a tmesh wrapper script
cat > "$DEMO_HOME/tmesh" << WRAPPER
#!/usr/bin/env bash
TMESH_HOME=$DEMO_HOME TMESH_IDENTITY=\$TMESH_IDENTITY exec bun run $REPO_DIR/src/cli/index.ts "\$@"
WRAPPER
chmod +x "$DEMO_HOME/tmesh"

# Kill leftover
tmux kill-session -t demo 2>/dev/null || true

# Create tmux session
tmux new-session -d -s demo -x 130 -y 30 "bash --norc --noprofile"
sleep 0.3

# Setup left pane (alpha)
tmux send-keys -t demo.0 "export PATH=$DEMO_HOME:\$PATH TMESH_IDENTITY=alpha" Enter
sleep 0.1
tmux send-keys -t demo.0 "PS1='alpha> '" Enter
sleep 0.1
tmux send-keys -t demo.0 "clear" Enter
sleep 0.2
tmux clear-history -t demo.0

# Split for beta
tmux split-window -h -t demo "bash --norc --noprofile"
sleep 0.3
tmux send-keys -t demo.1 "export PATH=$DEMO_HOME:\$PATH TMESH_IDENTITY=beta" Enter
sleep 0.1
tmux send-keys -t demo.1 "PS1='beta> '" Enter
sleep 0.1
tmux send-keys -t demo.1 "clear" Enter
sleep 0.2
tmux clear-history -t demo.1

# Focus left pane (alpha)
tmux select-pane -t demo.0
sleep 0.2

# Attach
tmux attach -t demo
