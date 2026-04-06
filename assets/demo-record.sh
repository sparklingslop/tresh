#!/usr/bin/env bash
# tmesh self-alignment demo -- ONE COMMAND, fully autonomous
#
# Run this in your Ghostty terminal:
#   cd tmesh && ./assets/demo-record.sh
#
# It will:
#   1. Create two tmux sessions (alice, bob)
#   2. Join them to the mesh
#   3. Launch Claude Code in each with ONE prompt
#   4. Wait for them to finish talking
#   5. Record a styled replay of the conversation
#   6. Convert to GIF
#
# Output: assets/demo-orchestration.gif

set -euo pipefail

TMESH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CLI="${TMESH_DIR}/src/cli/index.ts"
CAST="${TMESH_DIR}/assets/demo-orchestration.cast"
GIF="${TMESH_DIR}/assets/demo-orchestration.gif"

C='\033[0;36m'  # cyan
G='\033[0;32m'  # green
Y='\033[1;33m'  # yellow
B='\033[1m'     # bold
D='\033[2m'     # dim
N='\033[0m'     # reset

echo -e "${B}${C}tmesh demo recorder${N}"
echo -e "${D}────────────────────${N}"
echo ""

# ── Cleanup ──────────────────────────────────────────────────────────
tmux kill-session -t alice-demo 2>/dev/null || true
tmux kill-session -t bob-demo 2>/dev/null || true
rm -rf ~/.tmesh/nodes/alice ~/.tmesh/nodes/bob
rm -f "${CAST}" "${GIF}"

# ── Create sessions + join mesh ──────────────────────────────────────
echo -e "[1/6] ${G}Creating tmux sessions...${N}"
tmux new-session -d -s alice-demo
tmux new-session -d -s bob-demo
sleep 0.5

tmux send-keys -t alice-demo "export TMESH_IDENTITY=alice && cd ${TMESH_DIR} && bun run ${CLI} join alice --no-watch" Enter
sleep 3
tmux send-keys -t bob-demo "export TMESH_IDENTITY=bob && cd ${TMESH_DIR} && bun run ${CLI} join bob --no-watch" Enter
sleep 3

# ── Launch Claude Code ───────────────────────────────────────────────
echo -e "[2/6] ${G}Launching Claude Code agents...${N}"

ALICE_PROMPT="You are alice on a tmesh mesh. Run tmesh who to find other agents. Then send a greeting to bob with: tmesh send bob \"Hi Bob, I am alice, refactoring the payment service. What are you working on?\" -- When you see [tmesh ...] lines, reply with tmesh send <name> \"reply\". Have a 3-message conversation. Be concise."

BOB_PROMPT="You are bob on a tmesh mesh. Run tmesh who to discover agents. When you see a [tmesh ...] message, reply using tmesh send alice \"your reply\". You are working on a database migration for the auth service. Have a 3-message conversation. Be concise."

tmux send-keys -t alice-demo "claude --dangerously-skip-permissions '${ALICE_PROMPT}'" Enter
sleep 5
tmux send-keys -t bob-demo "claude --dangerously-skip-permissions '${BOB_PROMPT}'" Enter

# ── Wait for conversation ────────────────────────────────────────────
echo -e "[3/6] ${G}Waiting for agents to talk...${N}"
echo -e "      ${D}(watch live: tmux attach -t alice-demo)${N}"

for i in $(seq 1 30); do
  sleep 10
  AL=$(wc -l < ~/.tmesh/nodes/alice/conversation.log 2>/dev/null || echo 0)
  BL=$(wc -l < ~/.tmesh/nodes/bob/conversation.log 2>/dev/null || echo 0)
  AL=$(echo "$AL" | tr -d ' ')
  BL=$(echo "$BL" | tr -d ' ')
  echo -e "      ${D}check ${i}: alice=${AL} msgs, bob=${BL} msgs${N}"
  if [ "$AL" -ge 4 ] && [ "$BL" -ge 4 ]; then
    echo -e "      ${G}Conversation complete!${N}"
    break
  fi
done

# ── Record styled replay ─────────────────────────────────────────────
echo -e "[4/6] ${G}Recording conversation replay...${N}"

asciinema rec "${CAST}" \
  --cols 120 --rows 40 \
  --idle-time-limit 3 \
  --title "tmesh -- alice and bob self-aligning" \
  --command "bash -c '
    C=\"\033[0;36m\"; G=\"\033[0;32m\"; Y=\"\033[1;33m\"; B=\"\033[1m\"; D=\"\033[2m\"; N=\"\033[0m\"
    clear
    echo \"\"
    echo -e \"\${B}\${C}  tmesh\${N} \${D}-- two Claude Code agents, zero human input\${N}\"
    echo -e \"\${D}  =================================================\${N}\"
    echo \"\"
    echo -e \"  \${G}alice\${N}: refactoring payment service \${D}(Claude Code)\${N}\"
    echo -e \"  \${G}bob\${N}:   auth service DB migration \${D}(Claude Code)\${N}\"
    echo \"\"
    echo -e \"  \${D}Each agent got ONE prompt. Everything below is autonomous.\${N}\"
    echo \"\"
    sleep 3

    echo -e \"\${B}  Mesh Discovery\${N}\"
    echo -e \"\${D}  ──────────────\${N}\"
    echo \"\"
    TMESH_IDENTITY=alice bun run ${CLI} who 2>/dev/null
    echo \"\"
    sleep 2

    echo -e \"\${B}  Alice Conversation Log\${N}\"
    echo -e \"\${D}  ──────────────────────\${N}\"
    echo \"\"
    while IFS= read -r line; do
      if [[ \"\$line\" == *\"-->\"* ]]; then
        echo -e \"  \${G}\${line}\${N}\"
      elif [[ \"\$line\" == *\"<--\"* ]]; then
        echo -e \"  \${Y}\${line}\${N}\"
      fi
      sleep 2
    done < ~/.tmesh/nodes/alice/conversation.log
    echo \"\"
    sleep 2

    echo -e \"\${B}  Bob Conversation Log\${N}\"
    echo -e \"\${D}  ────────────────────\${N}\"
    echo \"\"
    while IFS= read -r line; do
      if [[ \"\$line\" == *\"-->\"* ]]; then
        echo -e \"  \${G}\${line}\${N}\"
      elif [[ \"\$line\" == *\"<--\"* ]]; then
        echo -e \"  \${Y}\${line}\${N}\"
      fi
      sleep 2
    done < ~/.tmesh/nodes/bob/conversation.log
    echo \"\"
    sleep 2

    echo -e \"\${B}  Mesh Topology\${N}\"
    echo -e \"\${D}  ─────────────\${N}\"
    echo \"\"
    TMESH_IDENTITY=alice bun run ${CLI} who --topology 2>/dev/null
    echo \"\"
    sleep 3

    echo \"\"
    echo -e \"  \${B}Autonomous coordination. Zero human input.\${N}\"
    echo -e \"  \${D}Zero broker. Zero cloud. Zero API keys. Just tmux.\${N}\"
    echo \"\"
    sleep 4
  '"

# ── Convert to GIF ───────────────────────────────────────────────────
echo -e "[5/6] ${G}Converting to GIF...${N}"
agg --speed 1.5 --theme dracula --font-size 16 "${CAST}" "${GIF}"

# ── Cleanup ──────────────────────────────────────────────────────────
echo -e "[6/6] ${G}Cleaning up...${N}"
tmux kill-session -t alice-demo 2>/dev/null || true
tmux kill-session -t bob-demo 2>/dev/null || true

echo ""
echo -e "${B}Done!${N}"
echo -e "  GIF: ${GIF}"
echo -e "  Size: $(du -h "${GIF}" | cut -f1)"
echo ""
