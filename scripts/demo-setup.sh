#!/usr/bin/env bash
# Pre-seeds tmesh state for the VHS demo recording.
# Creates a temp mesh home with two nodes and a short conversation history.

set -euo pipefail

DEMO_HOME="${1:-/tmp/tmesh-demo}"
rm -rf "$DEMO_HOME"

# Create mesh structure
mkdir -p "$DEMO_HOME/nodes/alpha/inbox"
mkdir -p "$DEMO_HOME/nodes/beta/inbox"

# Seed identities
echo "alpha" > "$DEMO_HOME/nodes/alpha/identity"
echo "beta" > "$DEMO_HOME/nodes/beta/identity"

# Pre-seed a short conversation for both sides
ALPHA_LOG="$DEMO_HOME/nodes/alpha/conversation.log"
cat > "$ALPHA_LOG" << 'CONVO'
[tmesh 2026-04-05 14:28:00] --> beta: starting auth refactor
[tmesh 2026-04-05 14:29:30] <-- beta [message]: go for it, I'll handle the frontend
CONVO

BETA_LOG="$DEMO_HOME/nodes/beta/conversation.log"
cat > "$BETA_LOG" << 'CONVO'
[tmesh 2026-04-05 14:28:00] <-- alpha [message]: starting auth refactor
[tmesh 2026-04-05 14:29:30] --> alpha: go for it, I'll handle the frontend
CONVO

echo "Demo state seeded at $DEMO_HOME"
