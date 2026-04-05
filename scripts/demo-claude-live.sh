#!/usr/bin/env bash
# Sets up two Claude Code sessions on the mesh.
# VHS attaches to this tmux session and types into the Claude prompts.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEMO_HOME="/tmp/tmesh-cc-demo"

# Clean slate
rm -rf "$DEMO_HOME"
mkdir -p "$DEMO_HOME/nodes/alpha/inbox"
mkdir -p "$DEMO_HOME/nodes/beta/inbox"

# Create tmesh wrapper with baked-in paths
cat > "$DEMO_HOME/tmesh" << WRAPPER
#!/usr/bin/env bash
exec bun run $REPO_DIR/src/cli/index.ts "\$@"
WRAPPER
chmod +x "$DEMO_HOME/tmesh"

# Kill leftover
tmux kill-session -t cc-demo 2>/dev/null || true

# Create session
tmux new-session -d -s cc-demo -x 160 -y 40 "bash --norc --noprofile"
sleep 0.3

# Left pane: set env, join mesh, launch claude
tmux send-keys -t cc-demo.0 "export PATH=$DEMO_HOME:\$PATH TMESH_HOME=$DEMO_HOME TMESH_IDENTITY=alpha" Enter
sleep 0.2
tmux send-keys -t cc-demo.0 "tmesh join alpha --no-watch 2>/dev/null" Enter
sleep 1
tmux send-keys -t cc-demo.0 "clear" Enter
sleep 0.2
tmux clear-history -t cc-demo.0
tmux send-keys -t cc-demo.0 "claude" Enter

# Split for beta
tmux split-window -h -t cc-demo "bash --norc --noprofile"
sleep 0.3

# Right pane: set env, join mesh, launch claude
tmux send-keys -t cc-demo.1 "export PATH=$DEMO_HOME:\$PATH TMESH_HOME=$DEMO_HOME TMESH_IDENTITY=beta" Enter
sleep 0.2
tmux send-keys -t cc-demo.1 "tmesh join beta --no-watch 2>/dev/null" Enter
sleep 1
tmux send-keys -t cc-demo.1 "clear" Enter
sleep 0.2
tmux clear-history -t cc-demo.1
tmux send-keys -t cc-demo.1 "claude" Enter

# Focus left pane
tmux select-pane -t cc-demo.0

echo "Two Claude Code sessions launching."
echo "Attach: tmux attach -t cc-demo"
