# tmesh -- real Claude Code split-pane demo
# Two Claude Code sessions side by side in tmux, talking via tmesh.

Output assets/demo-orchestration.gif
Set Shell "zsh"
Set FontSize 12
Set Width 1400
Set Height 750
Set Theme "Catppuccin Mocha"
Set Padding 5
Set TypingSpeed 0
Set Framerate 8

# ── Setup tmux with two panes (hidden) ──────────────────────────────
Hide
Type "bash /tmp/tmesh-demo-setup.sh"
Enter
Sleep 10s
Show

# ── Attach to tmux ──────────────────────────────────────────────────
Type "tmux attach -t demo"
Enter
Sleep 2s

# ── Left pane: launch alice ─────────────────────────────────────────
Set TypingSpeed 20ms
Type "bash /tmp/tmesh-demo-alice.sh"
Set TypingSpeed 0
Enter
Sleep 8s

# ── Switch to right pane ────────────────────────────────────────────
Ctrl+b
Sleep 300ms
Right
Sleep 1s

# ── Right pane: launch bob ──────────────────────────────────────────
Set TypingSpeed 20ms
Type "bash /tmp/tmesh-demo-bob.sh"
Set TypingSpeed 0
Enter

# ── Let the agents talk ─────────────────────────────────────────────
Sleep 150s

# ── Detach ──────────────────────────────────────────────────────────
Ctrl+b
Sleep 300ms
Type "d"
Sleep 3s
