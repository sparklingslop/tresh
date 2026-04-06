#!/usr/bin/env bash
# tmesh self-alignment demo
#
# Launches two Claude Code sessions (alice and bob) in split tmux panes.
# Each gets ONE prompt, then they autonomously coordinate via tmesh.
#
# Prerequisites:
#   - tmux running
#   - tmesh installed (bun add tmesh or bun link)
#   - Claude Code CLI installed (claude)
#
# Usage:
#   ./assets/demo-self-align.sh
#
# Record with:
#   Start recording your terminal (e.g., Ghostty, asciinema, OBS)
#   then run this script.

set -euo pipefail

TMESH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMESH_BIN="bun run ${TMESH_DIR}/src/cli/index.ts"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  tmesh self-alignment demo"
echo "  ========================="
echo "  Two Claude Code agents. One prompt each."
echo "  Then they talk to each other autonomously."
echo -e "${NC}"
sleep 2

# ---------------------------------------------------------------------------
# Cleanup previous state
# ---------------------------------------------------------------------------
tmux kill-session -t tmesh-demo 2>/dev/null || true
rm -rf ~/.tmesh/nodes/alice ~/.tmesh/nodes/bob
rm -f ~/.tmesh/conversation-alice.log ~/.tmesh/conversation-bob.log

# ---------------------------------------------------------------------------
# Create tmux session with two panes
# ---------------------------------------------------------------------------
echo -e "${GREEN}Creating tmux session with split panes...${NC}"
tmux new-session -d -s tmesh-demo -x 200 -y 50

# Set up alice (left pane)
tmux send-keys -t tmesh-demo "export TMESH_IDENTITY=alice" Enter
sleep 0.5
tmux send-keys -t tmesh-demo "cd ${TMESH_DIR}" Enter
sleep 0.3
tmux send-keys -t tmesh-demo "${TMESH_BIN} join alice --no-watch" Enter
sleep 1

# Split for bob (right pane)
tmux split-window -h -t tmesh-demo
sleep 0.3
tmux send-keys -t tmesh-demo:0.1 "export TMESH_IDENTITY=bob" Enter
sleep 0.5
tmux send-keys -t tmesh-demo:0.1 "cd ${TMESH_DIR}" Enter
sleep 0.3
tmux send-keys -t tmesh-demo:0.1 "${TMESH_BIN} join bob --no-watch" Enter
sleep 1

echo -e "${GREEN}Both agents joined the mesh.${NC}"
sleep 1

# ---------------------------------------------------------------------------
# Launch Claude Code in each pane with a single prompt
# ---------------------------------------------------------------------------
ALICE_PROMPT='You are "alice" on a tmesh mesh. Run `tmesh who` to see who else is online. Then send a message to any other node you find using `tmesh send <name> "your message"`. Introduce yourself and ask them what they are working on. When you receive replies (they appear as [tmesh ...] lines), respond to them. Have a brief conversation (3-4 exchanges). Use tmesh send for every message.'

BOB_PROMPT='You are "bob" on a tmesh mesh. Run `tmesh who` to see who else is online. When you receive a message from another agent (it appears as a [tmesh ...] line in your prompt), reply using `tmesh send <sender> "your reply"`. You are working on a database migration for the auth service. Mention this when asked. Have a brief conversation (3-4 exchanges). Use tmesh send for every message.'

echo -e "${CYAN}Launching Claude Code as alice (left pane)...${NC}"
tmux send-keys -t tmesh-demo:0.0 "claude --dangerously-skip-permissions \"${ALICE_PROMPT}\"" Enter
sleep 2

echo -e "${CYAN}Launching Claude Code as bob (right pane)...${NC}"
tmux send-keys -t tmesh-demo:0.1 "claude --dangerously-skip-permissions \"${BOB_PROMPT}\"" Enter
sleep 2

echo ""
echo -e "${GREEN}Both agents are running. Attach to watch them:${NC}"
echo ""
echo -e "  ${CYAN}tmux attach -t tmesh-demo${NC}"
echo ""
echo -e "They will autonomously discover each other and start talking."
echo -e "Press Ctrl+B then D to detach when done watching."
echo ""

# Auto-attach
tmux attach -t tmesh-demo
