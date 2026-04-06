# tmesh -- LIVE split-pane Claude Code demo
# Two agents building a Pong game, captured WHILE they work.
# VHS attaches to tmux, launches agents, records them live.

Output assets/demo-orchestration.gif
Set Shell "zsh"
Set FontSize 11
Set Width 1600
Set Height 800
Set Theme "Catppuccin Mocha"
Set Padding 5
Set TypingSpeed 0
Set Framerate 6

# ── Setup: create tmux session with splits, join mesh (hidden) ──────
Hide
Type "cd /Users/jankothyson/Code/sparkling-slop/tmesh"
Enter
Sleep 300ms
Type "tmux kill-session -t demo 2>/dev/null"
Enter
Sleep 300ms
Type "rm -rf ~/.tmesh/nodes/alice ~/.tmesh/nodes/bob /tmp/pong-game && mkdir -p /tmp/pong-game"
Enter
Sleep 300ms

# Create tmux session with horizontal split
Type "tmux new-session -d -s demo -x 200 -y 50"
Enter
Sleep 300ms

# Join alice on left pane
Type "tmux send-keys -t demo:0.0 'export TMESH_IDENTITY=alice && cd /Users/jankothyson/Code/sparkling-slop/tmesh && bun run src/cli/index.ts join alice --no-watch && clear' Enter"
Enter
Sleep 4s

# Split and join bob on right pane
Type "tmux split-window -h -t demo"
Enter
Sleep 300ms
Type "tmux send-keys -t demo:0.1 'export TMESH_IDENTITY=bob && cd /Users/jankothyson/Code/sparkling-slop/tmesh && bun run src/cli/index.ts join bob --no-watch && clear' Enter"
Enter
Sleep 4s
Show

# ── Attach to tmux -- NOW we see both panes ─────────────────────────
Type "tmux attach -t demo"
Enter
Sleep 2s

# ── Left pane (alice): launch Claude Code ────────────────────────────
Set TypingSpeed 15ms
Type "bash /tmp/tmesh-demo-alice.sh"
Set TypingSpeed 0
Enter
Sleep 8s

# ── Switch to right pane (bob): launch Claude Code ──────────────────
Ctrl+b
Sleep 300ms
Right
Sleep 1s

Set TypingSpeed 15ms
Type "bash /tmp/tmesh-demo-bob.sh"
Set TypingSpeed 0
Enter

# ── Record them working live for 3 minutes ──────────────────────────
# Both Claude Code sessions are now visible side by side.
# They will: build code, send tmesh messages, respond, coordinate.
Sleep 180s

# ── Detach ──────────────────────────────────────────────────────────
Ctrl+b
Sleep 200ms
Type "d"
Sleep 2s
