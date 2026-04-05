# tmesh: two Claude Code agents self-coordinating
# Alice and Bob are separate Claude sessions that communicate autonomously

Output assets/demo-claude.gif

Set Shell "bash"
Set FontSize 13
Set Width 1200
Set Height 650
Set Padding 10
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms

# --- Launch alice and bob Claude sessions on the mesh ---
Hide
Type "bash scripts/demo-claude-live.sh"
Enter
Sleep 35s
Show

# --- Attach: both Claude sessions visible ---
Type "tmux attach -t cc-demo"
Enter
Sleep 5s

# --- Alice: one prompt, then she coordinates autonomously ---
Type@50ms "Send a message to bob via tmesh asking if he is ready to deploy v1.0. Then watch for his reply with tmesh log --follow."
Enter
Sleep 40s

# --- Bob: one prompt, then he handles it ---
Ctrl+b
Right
Sleep 2s

Type@50ms "Check your tmesh inbox for messages and respond to the sender."
Enter
Sleep 40s

# --- Back to alice to see the reply ---
Ctrl+b
Left
Sleep 20s

# --- Hold ---
Sleep 5s

# --- Cleanup ---
Hide
Ctrl+c
Sleep 1s
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
