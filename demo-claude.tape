# tmesh + Claude Code demo
# Shows how to set up two Claude Code agents on the mesh

Output assets/demo-claude.gif

Set Shell "bash"
Set FontSize 14
Set Width 1100
Set Height 600
Set Padding 10
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms

# Launch orchestrator
Hide
Type "bash scripts/demo-claude-record.sh"
Enter
Sleep 5s
Show

# --- Clean split: left ($) | right ($) ---
Sleep 1s

# Left pane: one-time setup
Type "tmesh setup"
Enter
Sleep 2s

# Left pane: join the mesh as agent-alpha
Type "tmesh join agent-alpha --no-watch"
Enter
Sleep 2s

# Switch to right pane
Ctrl+b
Right
Sleep 600ms

# Right pane: join as agent-beta
Type "tmesh join agent-beta --no-watch"
Enter
Sleep 2s

# Right pane: check who's on the mesh
Type "tmesh who"
Enter
Sleep 2.5s

# Switch back to left (alpha)
Ctrl+b
Left
Sleep 600ms

# Alpha sends a message to beta
Type "tmesh send agent-beta 'auth refactor done, 421 tests pass'"
Enter
Sleep 3s

# Switch to beta
Ctrl+b
Right
Sleep 600ms

# Beta checks inbox
Type "tmesh log --inbox"
Enter
Sleep 2.5s

# Beta replies
Type "tmesh send agent-alpha 'nice, merging to main'"
Enter
Sleep 3s

# Switch to alpha
Ctrl+b
Left
Sleep 600ms

# Alpha sees the reply
Type "tmesh log"
Enter
Sleep 3s

# Alpha launches Claude Code
Type "# ready -- now launch Claude Code in each session"
Enter
Sleep 1.5s
Type "claude"
Enter
Sleep 3s

# Hold
Sleep 2s

# Cleanup
Hide
Ctrl+c
Sleep 500ms
Type "exit"
Enter
Sleep 300ms
Ctrl+b
Type ":"
Type "kill-session"
Enter
Sleep 500ms
