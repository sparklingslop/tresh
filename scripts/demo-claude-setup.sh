#!/usr/bin/env bash
# Pre-seeds tmesh state for the Claude Code demo.

set -euo pipefail

DEMO_HOME="${1:-/tmp/tmesh-claude-demo}"
rm -rf "$DEMO_HOME"

# Create mesh structure (setup already done)
mkdir -p "$DEMO_HOME/nodes/agent-alpha/inbox"
mkdir -p "$DEMO_HOME/nodes/agent-beta/inbox"

echo "Claude Code demo state seeded at $DEMO_HOME"
