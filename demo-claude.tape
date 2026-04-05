# tmesh: two Claude Code agents communicating via direct injection
# Alice injects into Bob's session. Bob responds by injecting back. No polling.

Output assets/demo-claude.gif

Set Shell "bash"
Set FontSize 13
Set Width 1200
Set Height 650
Set Padding 10
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms

# --- Launch alice and bob, accept trust, wait for full startup ---
Hide
Type "bash scripts/demo-claude-live.sh"
Enter
# 8s in script for trust + 40s more for full Claude startup
Sleep 50s
Show

# --- View alice's session (Claude should be ready) ---
Type "tmux attach -t alice"
Enter
Sleep 5s

# --- Give alice one task: find bob and inject a message ---
Type@50ms "Use tmesh who to find bob's session, then tmesh inject to ask him if he is ready to deploy v1.0"
Enter
Sleep 50s

# --- Switch to bob to see the injection arrive and his response ---
Ctrl+b
Type "d"
Sleep 1s

Type "tmux attach -t bob"
Enter
Sleep 60s

# --- Switch back to alice to see bob's reply ---
Ctrl+b
Type "d"
Sleep 1s

Type "tmux attach -t alice"
Enter
Sleep 30s

# --- Hold ---
Sleep 5s

# --- Cleanup ---
Hide
Ctrl+b
Type "d"
Sleep 500ms
Type "tmux kill-session -t alice; tmux kill-session -t bob"
Enter
Sleep 500ms
