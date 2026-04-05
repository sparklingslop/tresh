# tmesh + Claude Code: two real Claude sessions communicating
# Recorded with vhs (https://github.com/charmbracelet/vhs)

Output assets/demo-claude.gif

Set Shell "bash"
Set FontSize 13
Set Width 1200
Set Height 650
Set Padding 10
Set Theme "Catppuccin Mocha"
Set TypingSpeed 30ms

# --- Launch two Claude Code sessions (hidden) ---
Hide
Type "bash scripts/demo-claude-live.sh"
Enter
# Wait for both Claude instances to fully load
Sleep 25s
Show

# --- Attach to see both Claude sessions side by side ---
Type "tmux attach -t cc-demo"
Enter
Sleep 4s

# --- Alpha's Claude: send a tmesh message to beta ---
# ! prefix runs shell commands in Claude Code
Type "! tmesh send beta 'auth refactor done, all 421 tests pass'"
Enter
Sleep 10s

# --- Switch to beta's pane ---
Ctrl+b
Right
Sleep 2s

# --- Beta's Claude: check inbox ---
Type "! tmesh log --inbox"
Enter
Sleep 10s

# --- Beta replies ---
Type "! tmesh send alpha 'nice, merging to main'"
Enter
Sleep 10s

# --- Switch back to alpha ---
Ctrl+b
Left
Sleep 2s

# --- Alpha sees the full conversation ---
Type "! tmesh log"
Enter
Sleep 10s

# --- Hold final frame ---
Sleep 3s

# --- Cleanup (hidden) ---
Hide
Type "/exit"
Enter
Sleep 2s
Ctrl+b
Right
Sleep 500ms
Type "/exit"
Enter
Sleep 2s
Ctrl+b
Type ":"
Type "kill-session"
Enter
Sleep 500ms
