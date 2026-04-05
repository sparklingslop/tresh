#!/usr/bin/env bash
# Spins up two Claude Code agents (alice & bob) in separate project dirs.
# Each agent is on the tmesh mesh and can self-coordinate.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEMO_HOME="/tmp/tmesh-cc-demo"
ALICE_DIR="$HOME/Code/demos/alice"
BOB_DIR="$HOME/Code/demos/bob"

# Clean mesh state
rm -rf "$DEMO_HOME"
mkdir -p "$DEMO_HOME/nodes/alice/inbox"
mkdir -p "$DEMO_HOME/nodes/bob/inbox"

# Create tmesh wrapper with baked-in repo path
cat > "$DEMO_HOME/tmesh" << WRAPPER
#!/usr/bin/env bash
exec bun run $REPO_DIR/src/cli/index.ts "\$@"
WRAPPER
chmod +x "$DEMO_HOME/tmesh"

# Ensure project dirs exist with minimal CLAUDE.md
mkdir -p "$ALICE_DIR" "$BOB_DIR"

cat > "$ALICE_DIR/CLAUDE.md" << 'MD'
# Alice's workspace

You are agent "alice" on a tmesh mesh. tmesh is available in your PATH.
Use `tmesh send <target> '<message>'` to send messages.
Use `tmesh log --inbox` to check incoming messages.
Use `tmesh log` to see conversation history.
Use `tmesh log --follow` to watch for new messages in real-time.
MD

cat > "$BOB_DIR/CLAUDE.md" << 'MD'
# Bob's workspace

You are agent "bob" on a tmesh mesh. tmesh is available in your PATH.
Use `tmesh send <target> '<message>'` to send messages.
Use `tmesh log --inbox` to check incoming messages.
Use `tmesh log` to see conversation history.
Use `tmesh log --follow` to watch for new messages in real-time.
MD

# Kill leftover
tmux kill-session -t cc-demo 2>/dev/null || true

# Create session -- alice in left pane
tmux new-session -d -s cc-demo -x 160 -y 40 "bash --norc --noprofile"
sleep 0.3

# Alice: set env, join mesh, launch claude
tmux send-keys -t cc-demo.0 "cd $ALICE_DIR" Enter
sleep 0.1
tmux send-keys -t cc-demo.0 "export PATH=$DEMO_HOME:\$PATH TMESH_HOME=$DEMO_HOME TMESH_IDENTITY=alice" Enter
sleep 0.2
tmux send-keys -t cc-demo.0 "tmesh join alice --no-watch 2>/dev/null" Enter
sleep 1
tmux send-keys -t cc-demo.0 "clear" Enter
sleep 0.2
tmux clear-history -t cc-demo.0
tmux send-keys -t cc-demo.0 "claude" Enter

# Split for bob
tmux split-window -h -t cc-demo "bash --norc --noprofile"
sleep 0.3

# Bob: set env, join mesh, launch claude
tmux send-keys -t cc-demo.1 "cd $BOB_DIR" Enter
sleep 0.1
tmux send-keys -t cc-demo.1 "export PATH=$DEMO_HOME:\$PATH TMESH_HOME=$DEMO_HOME TMESH_IDENTITY=bob" Enter
sleep 0.2
tmux send-keys -t cc-demo.1 "tmesh join bob --no-watch 2>/dev/null" Enter
sleep 1
tmux send-keys -t cc-demo.1 "clear" Enter
sleep 0.2
tmux clear-history -t cc-demo.1
tmux send-keys -t cc-demo.1 "claude" Enter

# Focus left pane (alice)
tmux select-pane -t cc-demo.0

echo "Alice and Bob launching on the mesh."
echo "Attach: tmux attach -t cc-demo"
