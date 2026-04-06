#!/usr/bin/env bash
# tmesh self-alignment demo -- fully autonomous recording
#
# 1) Creates two tmux sessions (alice, bob)
# 2) Joins them to the mesh
# 3) Launches Claude Code in each with ONE prompt
# 4) Records a terminal session showing the live conversation log
# 5) Converts to GIF
#
# Output: assets/demo-orchestration.gif
#
# Usage: ./assets/demo-record.sh

set -euo pipefail

TMESH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMESH_CLI="${TMESH_DIR}/src/cli/index.ts"
CAST_FILE="${TMESH_DIR}/assets/demo-orchestration.cast"
GIF_FILE="${TMESH_DIR}/assets/demo-orchestration.gif"
WAIT_SECONDS=90

echo "tmesh self-alignment demo"
echo "========================="

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
tmux kill-session -t alice-demo 2>/dev/null || true
tmux kill-session -t bob-demo 2>/dev/null || true
rm -rf ~/.tmesh/nodes/alice ~/.tmesh/nodes/bob
rm -f ~/.tmesh/conversation-alice.log ~/.tmesh/conversation-bob.log
rm -f "${CAST_FILE}" "${GIF_FILE}"

# ---------------------------------------------------------------------------
# Create sessions and join mesh
# ---------------------------------------------------------------------------
echo "[1/5] Creating tmux sessions..."
tmux new-session -d -s alice-demo
tmux new-session -d -s bob-demo
sleep 0.5

echo "[2/5] Joining mesh..."
tmux send-keys -t alice-demo "export TMESH_IDENTITY=alice && cd ${TMESH_DIR} && bun run ${TMESH_CLI} join alice --no-watch" Enter
sleep 2
tmux send-keys -t bob-demo "export TMESH_IDENTITY=bob && cd ${TMESH_DIR} && bun run ${TMESH_CLI} join bob --no-watch" Enter
sleep 2

# ---------------------------------------------------------------------------
# Launch Claude Code in each session
# ---------------------------------------------------------------------------
echo "[3/5] Launching Claude Code agents..."

ALICE_PROMPT="You are 'alice' on a tmesh mesh. Run: tmesh who -- to find other agents. Then run: tmesh send bob \"Hi Bob, I'm alice. What are you working on?\" -- to start a conversation. When you see [tmesh ...] lines those are incoming messages. Reply with tmesh send <name> \"reply\". Have a 3-message conversation. You are refactoring the payment service. Be brief."

BOB_PROMPT="You are 'bob' on a tmesh mesh. Run: tmesh who -- to discover agents. When you see a [tmesh ...] message, reply using: tmesh send alice \"your reply\". You are working on a database migration for the auth service. Have a 3-message conversation. Be brief."

tmux send-keys -t alice-demo "claude --dangerously-skip-permissions \"${ALICE_PROMPT}\"" Enter
sleep 2
tmux send-keys -t bob-demo "claude --dangerously-skip-permissions \"${BOB_PROMPT}\"" Enter
sleep 2

# ---------------------------------------------------------------------------
# Record the live conversation using asciinema
# ---------------------------------------------------------------------------
echo "[4/5] Recording conversation (${WAIT_SECONDS}s)..."
echo "      Agents are talking. Watch live:"
echo "        tmux attach -t alice-demo  (or bob-demo)"
echo ""

# Record a terminal that shows both conversation logs tailing live
asciinema rec "${CAST_FILE}" \
  --cols 120 --rows 40 \
  --idle-time-limit 2 \
  --title "tmesh -- alice and bob self-aligning via tmux" \
  --command "bash -c '
    echo \"\"
    echo \"  tmesh -- two Claude Code agents, zero human input\"
    echo \"  =================================================\"
    echo \"\"
    echo \"  alice: refactoring payment service\"
    echo \"  bob:   database migration for auth\"
    echo \"\"
    echo \"  Watching conversation logs...\"
    echo \"  ---\"
    echo \"\"
    sleep 2

    # Show who is on the mesh
    TMESH_IDENTITY=alice bun run ${TMESH_CLI} who 2>/dev/null
    echo \"\"
    echo \"  --- Live conversation (both agents) ---\"
    echo \"\"
    sleep 1

    # Tail both conversation logs interleaved
    tail -f ~/.tmesh/conversation-alice.log ~/.tmesh/conversation-bob.log 2>/dev/null &
    TAIL_PID=\$!

    # Wait for conversation to play out
    sleep ${WAIT_SECONDS}

    kill \$TAIL_PID 2>/dev/null || true
    echo \"\"
    echo \"\"
    echo \"  Conversation complete.\"
    echo \"  Zero broker. Zero cloud. Zero API keys. Just tmux.\"
    echo \"\"
    sleep 3
  '"

# ---------------------------------------------------------------------------
# Cleanup and convert
# ---------------------------------------------------------------------------
echo "[5/5] Converting to GIF..."
tmux kill-session -t alice-demo 2>/dev/null || true
tmux kill-session -t bob-demo 2>/dev/null || true

if [ -f "${CAST_FILE}" ]; then
  agg --speed 2 --theme dracula --font-size 16 "${CAST_FILE}" "${GIF_FILE}"
  echo ""
  echo "Done!"
  echo "  Cast: ${CAST_FILE}"
  echo "  GIF:  ${GIF_FILE}"
  echo "  Size: $(du -h "${GIF_FILE}" | cut -f1)"
else
  echo "ERROR: No recording found."
  exit 1
fi
