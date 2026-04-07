# tmesh -- LIVE split-pane Claude Code demo
# Two agents build a Pong game + play 5 rounds. Captured live.

Output assets/demo-orchestration.gif
Set Shell "zsh"
Set FontSize 11
Set Width 1600
Set Height 800
Set Theme "Catppuccin Mocha"
Set Padding 5
Set TypingSpeed 0
Set Framerate 4

# ── Setup (hidden) ──────────────────────────────────────────────────
Hide
Type "cd /Users/jankothyson/Code/sparkling-slop/tmesh"
Enter
Sleep 300ms
Type "tmux kill-session -t demo 2>/dev/null; rm -rf ~/.tmesh/nodes/alice ~/.tmesh/nodes/bob /tmp/pong-game && mkdir -p /tmp/pong-game"
Enter
Sleep 500ms
Type "tmux new-session -d -s demo -x 200 -y 50"
Enter
Sleep 300ms
Type "tmux send-keys -t demo:0.0 'export TMESH_IDENTITY=alice && cd /Users/jankothyson/Code/sparkling-slop/tmesh && bun run src/cli/index.ts join alice --no-watch && clear' Enter"
Enter
Sleep 4s
Type "tmux split-window -h -t demo"
Enter
Sleep 300ms
Type "tmux send-keys -t demo:0.1 'export TMESH_IDENTITY=bob && cd /Users/jankothyson/Code/sparkling-slop/tmesh && bun run src/cli/index.ts join bob --no-watch && clear' Enter"
Enter
Sleep 4s
Show

# ── Attach: both panes visible ──────────────────────────────────────
Type "tmux attach -t demo"
Enter
Sleep 2s

# ── Left pane: alice ────────────────────────────────────────────────
Set TypingSpeed 15ms
Type "bash /tmp/tmesh-demo-alice.sh"
Set TypingSpeed 0
Enter
Sleep 8s

# ── Right pane: bob ─────────────────────────────────────────────────
Ctrl+b
Sleep 300ms
Right
Sleep 1s
Set TypingSpeed 15ms
Type "bash /tmp/tmesh-demo-bob.sh"
Set TypingSpeed 0
Enter

# ── Let them build, coordinate, and test ─────────────────────────────
# ~4 min for: build engine, share API, build frontend, compile, test
Sleep 240s

# ── Detach ──────────────────────────────────────────────────────────
Ctrl+b
Sleep 200ms
Type "d"
Sleep 2s
