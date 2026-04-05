#!/usr/bin/env bash
# Spins up two Claude Code agents (alice & bob) that communicate via injection.
# Handles the trust prompt and waits for full startup.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEMO_HOME="/tmp/tmesh-cc-demo"
ALICE_DIR="$HOME/Code/demos/alice"
BOB_DIR="$HOME/Code/demos/bob"

# Clean mesh state
rm -rf "$DEMO_HOME"
mkdir -p "$DEMO_HOME/nodes/alice/inbox"
mkdir -p "$DEMO_HOME/nodes/bob/inbox"

# Create tmesh wrapper
cat > "$DEMO_HOME/tmesh" << WRAPPER
#!/usr/bin/env bash
exec bun run $REPO_DIR/src/cli/index.ts "\$@"
WRAPPER
chmod +x "$DEMO_HOME/tmesh"

# Kill leftover sessions
tmux kill-session -t alice 2>/dev/null || true
tmux kill-session -t bob 2>/dev/null || true

# --- Alice session ---
tmux new-session -d -s alice -x 80 -y 40 "bash --norc --noprofile"
sleep 0.3
tmux send-keys -t alice "cd $ALICE_DIR" Enter
tmux send-keys -t alice "export PATH=$DEMO_HOME:\$PATH TMESH_HOME=$DEMO_HOME TMESH_IDENTITY=alice" Enter
sleep 0.2
tmux send-keys -t alice "tmesh join alice --no-watch 2>/dev/null" Enter
sleep 1
tmux send-keys -t alice "clear" Enter
sleep 0.2
tmux clear-history -t alice
tmux send-keys -t alice "claude" Enter

# --- Bob session ---
tmux new-session -d -s bob -x 80 -y 40 "bash --norc --noprofile"
sleep 0.3
tmux send-keys -t bob "cd $BOB_DIR" Enter
tmux send-keys -t bob "export PATH=$DEMO_HOME:\$PATH TMESH_HOME=$DEMO_HOME TMESH_IDENTITY=bob" Enter
sleep 0.2
tmux send-keys -t bob "tmesh join bob --no-watch 2>/dev/null" Enter
sleep 1
tmux send-keys -t bob "clear" Enter
sleep 0.2
tmux clear-history -t bob
tmux send-keys -t bob "claude" Enter

# Wait for trust prompt to appear, then accept it for both
sleep 8
tmux send-keys -t alice Enter
tmux send-keys -t bob Enter

echo "Alice and Bob launching. Trust prompts accepted."
echo "Wait ~30s for full startup, then:"
echo "  tmux attach -t alice"
echo "  tmux attach -t bob"
