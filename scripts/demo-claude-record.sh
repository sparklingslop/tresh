#!/usr/bin/env bash
# Orchestrates the Claude Code demo inside a tmux session.
# Shows how to set up tmesh for two Claude Code agents.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEMO_HOME="/tmp/tmesh-claude-demo"

# Seed state
bash "$REPO_DIR/scripts/demo-claude-setup.sh" "$DEMO_HOME"

# Create tmesh wrapper
cat > "$DEMO_HOME/tmesh" << WRAPPER
#!/usr/bin/env bash
TMESH_HOME=$DEMO_HOME TMESH_IDENTITY=\$TMESH_IDENTITY exec bun run $REPO_DIR/src/cli/index.ts "\$@"
WRAPPER
chmod +x "$DEMO_HOME/tmesh"

# Kill leftover
tmux kill-session -t claude-demo 2>/dev/null || true

# Create session with bash
tmux new-session -d -s claude-demo -x 130 -y 35 "bash --norc --noprofile"
sleep 0.3

# Setup left pane
tmux send-keys -t claude-demo.0 "export PATH=$DEMO_HOME:\$PATH TMESH_IDENTITY=agent-alpha" Enter
sleep 0.1
tmux send-keys -t claude-demo.0 "PS1='$ '" Enter
sleep 0.1
tmux send-keys -t claude-demo.0 "clear" Enter
sleep 0.2
tmux clear-history -t claude-demo.0

# Split for right pane
tmux split-window -h -t claude-demo "bash --norc --noprofile"
sleep 0.3
tmux send-keys -t claude-demo.1 "export PATH=$DEMO_HOME:\$PATH TMESH_IDENTITY=agent-beta" Enter
sleep 0.1
tmux send-keys -t claude-demo.1 "PS1='$ '" Enter
sleep 0.1
tmux send-keys -t claude-demo.1 "clear" Enter
sleep 0.2
tmux clear-history -t claude-demo.1

# Focus left pane
tmux select-pane -t claude-demo.0
sleep 0.2

# Attach
tmux attach -t claude-demo
