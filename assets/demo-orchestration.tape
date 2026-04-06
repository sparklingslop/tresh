# tmesh -- real Claude Code agents building a Pong game together
# Split tmux panes, real work, real coordination via tmesh.
# Recorded AFTER the conversation happened -- shows the actual tmux panes.

Output assets/demo-orchestration.gif
Set Shell "zsh"
Set FontSize 12
Set Width 1400
Set Height 750
Set Theme "Catppuccin Mocha"
Set Padding 5
Set TypingSpeed 0
Set Framerate 8

# Attach to the live demo session (already has both agents finished)
Type "tmux attach -t demo"
Enter
Sleep 5s

# Show alice's pane -- scroll up to see the conversation
Ctrl+b
Sleep 200ms
Left
Sleep 1s

# Use tmux copy mode to scroll and show alice's work
Ctrl+b
Sleep 200ms
Type "["
Sleep 500ms

# Scroll up to see the full conversation
Type "g"
Sleep 3s

# Scroll down slowly
Down Down Down Down Down Down Down Down Down Down
Sleep 2s
Down Down Down Down Down Down Down Down Down Down
Sleep 2s
Down Down Down Down Down Down Down Down Down Down
Sleep 2s
Down Down Down Down Down Down Down Down Down Down
Sleep 2s
Down Down Down Down Down Down Down Down Down Down
Sleep 2s

# Exit copy mode
Type "q"
Sleep 1s

# Switch to bob's pane
Ctrl+b
Sleep 200ms
Right
Sleep 2s

# Scroll bob's pane
Ctrl+b
Sleep 200ms
Type "["
Sleep 500ms
Type "g"
Sleep 3s
Down Down Down Down Down Down Down Down Down Down
Sleep 2s
Down Down Down Down Down Down Down Down Down Down
Sleep 2s
Down Down Down Down Down Down Down Down Down Down
Sleep 2s
Down Down Down Down Down Down Down Down Down Down
Sleep 2s
Down Down Down Down Down Down Down Down Down Down
Sleep 2s

Type "q"
Sleep 1s

# Detach
Ctrl+b
Sleep 200ms
Type "d"
Sleep 1s

# Show the conversation logs side by side
Type "echo ''"
Enter
Type "echo '  RESULT: Two Claude Code agents built a working Pong game'"
Enter
Type "echo ''"
Enter
Type "ls -la /tmp/pong-game/"
Enter
Sleep 3s
Type "echo ''"
Enter
Type "echo '  CONVERSATION LOG (alice):'"
Enter
Type "cat ~/.tmesh/nodes/alice/conversation.log"
Enter
Sleep 5s
Type "echo ''"
Enter
Type "echo '  Zero broker. Zero cloud. Zero API keys. Just tmux.'"
Enter
Sleep 5s
