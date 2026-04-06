# tmesh -- real work + real coordination demo
# Alice builds pong frontend, Bob builds game engine.
# They coordinate via tmesh when they need to align on the API.

Output assets/demo-orchestration.gif
Set Shell "zsh"
Set FontSize 12
Set Width 1400
Set Height 750
Set Theme "Catppuccin Mocha"
Set Padding 5
Set TypingSpeed 0
Set Framerate 8

# ── Setup (hidden) ──────────────────────────────────────────────────
Hide
Type "bash /tmp/tmesh-demo-setup.sh"
Enter
Sleep 12s
Show

# ── Attach to split tmux ────────────────────────────────────────────
Type "tmux attach -t demo"
Enter
Sleep 2s

# ── Left pane: alice starts building frontend ────────────────────────
Set TypingSpeed 20ms
Type "bash /tmp/tmesh-demo-alice.sh"
Set TypingSpeed 0
Enter
Sleep 8s

# ── Switch to right pane: bob starts building engine ─────────────────
Ctrl+b
Sleep 300ms
Right
Sleep 1s

Set TypingSpeed 20ms
Type "bash /tmp/tmesh-demo-bob.sh"
Set TypingSpeed 0
Enter

# ── Let them work and coordinate ─────────────────────────────────────
# Bob codes the engine, alice codes the frontend.
# Alice asks bob for the API, bob responds.
# Both produce real files at /tmp/pong-game/
Sleep 180s

# ── Done ─────────────────────────────────────────────────────────────
Ctrl+b
Sleep 300ms
Type "d"
Sleep 3s
