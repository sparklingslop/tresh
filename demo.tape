# tmesh demo -- two agents in split panes exchanging signals
# Recorded with vhs (https://github.com/charmbracelet/vhs)

Output assets/demo.gif

Set Shell "bash"
Set FontSize 14
Set Width 1100
Set Height 550
Set Padding 10
Set Theme "Catppuccin Mocha"
Set TypingSpeed 30ms

# Launch the demo orchestrator (sets up tmux + attaches)
Hide
Type "bash scripts/demo-record.sh"
Enter
Sleep 5s
Show

# --- Both panes now visible: alpha (left) | beta (right) ---
Sleep 1.5s

# Alpha shows conversation history (left pane is focused)
Type "tmesh log"
Enter
Sleep 2.5s

# Alpha sends a message to beta
Type "tmesh send beta 'all 421 tests pass. ready to merge'"
Enter
Sleep 3s

# Switch to beta (right pane)
Ctrl+b
Right
Sleep 800ms

# Beta checks inbox
Type "tmesh log --inbox"
Enter
Sleep 2.5s

# Beta replies
Type "tmesh send alpha 'LGTM. ship it'"
Enter
Sleep 3s

# Switch back to alpha
Ctrl+b
Left
Sleep 800ms

# Alpha sees full conversation
Type "tmesh log"
Enter
Sleep 3s

# Alpha broadcasts
Type "tmesh send '*' 'v1.0 released'"
Enter
Sleep 3s

# Switch to beta to see broadcast arrived
Ctrl+b
Right
Sleep 800ms

Type "tmesh log --inbox"
Enter
Sleep 3s

# Hold final frame
Sleep 2s

# Cleanup
Hide
Ctrl+b
Type ":"
Type "kill-session"
Enter
Sleep 500ms
