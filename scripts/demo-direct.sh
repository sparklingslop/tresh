#!/usr/bin/env bash
# Direct demo: runs tresh commands without tmux nesting.
# Alice sends, bob reads inbox. Clean and recordable by VHS.
set -euo pipefail
cd "$(dirname "$0")/.."

export TRESH_DIR="/tmp/tresh-demo-$$"
rm -rf "$TRESH_DIR"

TRESH="bun run $(pwd)/src/cli.ts"

# Alice sends messages to bob
export TRESH_ID=alice
$TRESH send bob "hello from alice"
$TRESH send bob "review PR 42?"
$TRESH send bob "tests pass, ship it"

echo ""

# Bob reads inbox
export TRESH_ID=bob
$TRESH inbox

# Cleanup
rm -rf "$TRESH_DIR"
