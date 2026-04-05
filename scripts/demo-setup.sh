#!/usr/bin/env bash
# Pre-seeds tmesh state for the VHS demo recording.
# Creates a temp mesh home with two nodes and pre-existing conversation.

set -euo pipefail

DEMO_HOME="${1:-/tmp/tmesh-demo}"
rm -rf "$DEMO_HOME"

# Create mesh structure
mkdir -p "$DEMO_HOME/nodes/alpha/inbox"
mkdir -p "$DEMO_HOME/nodes/beta/inbox"
echo "alpha" > "$DEMO_HOME/identity"

# Pre-seed a short conversation for alpha
ALPHA_LOG="$DEMO_HOME/nodes/alpha/conversation.log"
cat > "$ALPHA_LOG" << 'CONVO'
[tmesh 2026-04-05 14:30:00] --> beta: Hey beta, I finished the auth refactor
[tmesh 2026-04-05 14:30:15] <-- beta [message]: Nice. Tests passing?
[tmesh 2026-04-05 14:30:30] --> beta: All 421 green
CONVO

echo "Demo state seeded at $DEMO_HOME"
