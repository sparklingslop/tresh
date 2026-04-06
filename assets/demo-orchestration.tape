# tmesh agent orchestration demo
# Two Claude Code sessions communicating via tmesh
#
# Record with: vhs assets/demo-orchestration.tape

Output assets/demo-orchestration.gif
Set Shell "zsh"
Set FontSize 14
Set Width 1200
Set Height 700
Set Theme "Catppuccin Mocha"
Set Padding 20
Set TypingSpeed 50ms

# -- Setup --
Type "# tmesh -- agent orchestration demo"
Enter
Sleep 500ms
Type "# Two agents discover each other and exchange signals"
Enter
Sleep 1s

# Create two tmux sessions
Type "tmux new-session -d -s agent-alpha"
Enter
Sleep 300ms
Type "tmux new-session -d -s agent-beta"
Enter
Sleep 300ms

# Join mesh with identities
Type "TMESH_IDENTITY=alpha bun run src/cli/index.ts join agent-alpha alpha"
Enter
Sleep 1s

Type "TMESH_IDENTITY=beta bun run src/cli/index.ts join agent-beta beta"
Enter
Sleep 1s

# Show who's on the mesh
Type "TMESH_IDENTITY=alpha bun run src/cli/index.ts who"
Enter
Sleep 2s

# Agent alpha sends a message to beta
Type "TMESH_IDENTITY=alpha bun run src/cli/index.ts send beta 'Hey beta, can you review the auth module?'"
Enter
Sleep 2s

# Check beta's inbox
Type "TMESH_IDENTITY=beta bun run src/cli/index.ts log --inbox"
Enter
Sleep 2s

# Beta replies
Type "TMESH_IDENTITY=beta bun run src/cli/index.ts send alpha 'On it. Found 2 issues in jwt validation.'"
Enter
Sleep 2s

# Alpha checks conversation log
Type "TMESH_IDENTITY=alpha bun run src/cli/index.ts log"
Enter
Sleep 2s

# Broadcast to all
Type "TMESH_IDENTITY=alpha bun run src/cli/index.ts send '*' 'Review complete. Merging to main.'"
Enter
Sleep 2s

# Peek at beta's screen
Type "TMESH_IDENTITY=alpha bun run src/cli/index.ts peek agent-beta --lines 5"
Enter
Sleep 2s

# Show final mesh state
Type "TMESH_IDENTITY=alpha bun run src/cli/index.ts who --topology"
Enter
Sleep 3s

# Cleanup
Type "tmux kill-session -t agent-alpha 2>/dev/null; tmux kill-session -t agent-beta 2>/dev/null"
Enter
Sleep 500ms
Type "# Zero infrastructure. Zero dependencies. Just tmux."
Enter
Sleep 2s
