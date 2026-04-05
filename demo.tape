# tmesh demo -- two agents exchanging signals
# Recorded with vhs (https://github.com/charmbracelet/vhs)

Output assets/demo.gif

Set Shell "bash"
Set FontSize 15
Set Width 960
Set Height 540
Set Padding 16
Set Theme "Catppuccin Mocha"
Set TypingSpeed 35ms

# Seed demo state (hidden -- runs before recording starts)
Hide
Type "bash scripts/demo-setup.sh /tmp/tmesh-demo"
Enter
Sleep 500ms
Type "export TMESH_HOME=/tmp/tmesh-demo"
Enter
Sleep 200ms
Type "alias tmesh='TMESH_HOME=/tmp/tmesh-demo bun run src/cli/index.ts'"
Enter
Sleep 200ms
Type "clear"
Enter
Sleep 500ms
Show

# -- Recording starts --

# Show existing conversation
Type "# alpha checks the conversation so far"
Enter
Sleep 800ms

Type "TMESH_IDENTITY=alpha tmesh log"
Enter
Sleep 2.5s

# Alpha sends a new message
Type "# alpha sends a deploy notification"
Enter
Sleep 800ms

Type "TMESH_IDENTITY=alpha tmesh send beta 'Deploy complete. Merging to main.'"
Enter
Sleep 2.5s

# Switch to beta's perspective -- check inbox
Type "# beta checks their inbox"
Enter
Sleep 800ms

Type "TMESH_IDENTITY=beta tmesh log --inbox"
Enter
Sleep 2.5s

# Beta replies
Type "# beta replies"
Enter
Sleep 800ms

Type "TMESH_IDENTITY=beta tmesh send alpha 'LGTM. Ship it.'"
Enter
Sleep 2.5s

# Alpha broadcasts to the whole mesh
Type "# alpha broadcasts to everyone"
Enter
Sleep 800ms

Type "TMESH_IDENTITY=alpha tmesh send '*' 'v1.0 released.'"
Enter
Sleep 2.5s

# Show the full conversation from alpha's view
Type "# the full conversation log"
Enter
Sleep 800ms

Type "TMESH_IDENTITY=alpha tmesh log"
Enter
Sleep 3s

# Closing
Sleep 1s
Type "# zero infrastructure. just tmux."
Enter
Sleep 3s
