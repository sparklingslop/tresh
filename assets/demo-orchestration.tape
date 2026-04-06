# tmesh -- real two-agent demo
# Shows alice and bob exchanging messages via tmesh.
# Each command shows which agent is acting.
#
# Record with: vhs assets/demo-orchestration.tape

Output assets/demo-orchestration.gif
Set Shell "zsh"
Set FontSize 14
Set Width 1000
Set Height 650
Set Theme "Catppuccin Mocha"
Set Padding 15
Set TypingSpeed 30ms

# ---------------------------------------------------------------------------
# Setup (hidden)
# ---------------------------------------------------------------------------
Hide
Type "cd /Users/jankothyson/Code/sparkling-slop/tmesh"
Enter
Sleep 200ms
Type "alias tm='bun run src/cli/index.ts'"
Enter
Sleep 200ms
# Clean up any previous state
Type "tmux kill-session -t alice 2>/dev/null; tmux kill-session -t bob 2>/dev/null"
Enter
Sleep 200ms
Type "rm -rf ~/.tmesh/nodes/alice ~/.tmesh/nodes/bob ~/.tmesh/conversation-alice.log ~/.tmesh/conversation-bob.log"
Enter
Sleep 200ms
# Create two background tmux sessions
Type "tmux new-session -d -s alice"
Enter
Sleep 300ms
Type "tmux new-session -d -s bob"
Enter
Sleep 300ms
Show

# ---------------------------------------------------------------------------
# Title
# ---------------------------------------------------------------------------
Type "echo ''"
Enter
Type "echo '  tmesh -- two agents, one mesh, zero infrastructure'"
Enter
Type "echo '  ================================================'"
Enter
Type "echo ''"
Enter
Sleep 1500ms

# ---------------------------------------------------------------------------
# Phase 1: Bootstrap both sessions onto the mesh
# ---------------------------------------------------------------------------
Type "echo '--- Phase 1: Bootstrap alice and bob onto the mesh ---'"
Enter
Sleep 800ms

Type "TMESH_IDENTITY=alice tm join alice alice --no-watch"
Enter
Sleep 1500ms

Type "TMESH_IDENTITY=bob tm join bob bob --no-watch"
Enter
Sleep 1500ms

# ---------------------------------------------------------------------------
# Phase 2: Discovery -- who's on the mesh?
# ---------------------------------------------------------------------------
Type "echo ''"
Enter
Type "echo '--- Phase 2: Who is on the mesh? ---'"
Enter
Sleep 800ms

Type "TMESH_IDENTITY=alice tm who"
Enter
Sleep 2500ms

# ---------------------------------------------------------------------------
# Phase 3: Alice sends a message to Bob
# ---------------------------------------------------------------------------
Type "echo ''"
Enter
Type "echo '--- Phase 3: Alice sends a message to Bob ---'"
Enter
Sleep 800ms

Type "TMESH_IDENTITY=alice tm send bob 'Hey Bob, can you review the auth module? I found a suspicious jwt.verify() call.'"
Enter
Sleep 2500ms

# ---------------------------------------------------------------------------
# Phase 4: Bob checks his inbox and sees Alice's message
# ---------------------------------------------------------------------------
Type "echo ''"
Enter
Type "echo '--- Phase 4: Bob checks inbox ---'"
Enter
Sleep 800ms

Type "TMESH_IDENTITY=bob tm log --inbox"
Enter
Sleep 2500ms

# ---------------------------------------------------------------------------
# Phase 5: Bob replies
# ---------------------------------------------------------------------------
Type "echo ''"
Enter
Type "echo '--- Phase 5: Bob replies ---'"
Enter
Sleep 800ms

Type "TMESH_IDENTITY=bob tm send alice 'Confirmed. The jwt.verify() is missing audience check. PR #47 incoming.'"
Enter
Sleep 2500ms

# ---------------------------------------------------------------------------
# Phase 6: Alice sees the full conversation
# ---------------------------------------------------------------------------
Type "echo ''"
Enter
Type "echo '--- Phase 6: Alice sees the conversation ---'"
Enter
Sleep 800ms

Type "TMESH_IDENTITY=alice tm log"
Enter
Sleep 3000ms

# ---------------------------------------------------------------------------
# Phase 7: Alice peeks at Bob's tmux screen
# ---------------------------------------------------------------------------
Type "echo ''"
Enter
Type "echo '--- Phase 7: Alice peeks at Bobs screen (capture-pane) ---'"
Enter
Sleep 800ms

Type "TMESH_IDENTITY=alice tm peek bob --lines 8"
Enter
Sleep 3000ms

# ---------------------------------------------------------------------------
# Phase 8: Broadcast to all nodes
# ---------------------------------------------------------------------------
Type "echo ''"
Enter
Type "echo '--- Phase 8: Alice broadcasts to all nodes ---'"
Enter
Sleep 800ms

Type "TMESH_IDENTITY=alice tm send '*' 'Auth fix merged to main. All clear.'"
Enter
Sleep 2500ms

# Bob sees the broadcast
Type "TMESH_IDENTITY=bob tm log"
Enter
Sleep 3000ms

# ---------------------------------------------------------------------------
# Phase 9: Show topology
# ---------------------------------------------------------------------------
Type "echo ''"
Enter
Type "echo '--- Phase 9: Mesh topology ---'"
Enter
Sleep 800ms

Type "TMESH_IDENTITY=alice tm who --topology"
Enter
Sleep 3000ms

# ---------------------------------------------------------------------------
# Cleanup & outro
# ---------------------------------------------------------------------------
Hide
Type "tmux kill-session -t alice 2>/dev/null; tmux kill-session -t bob 2>/dev/null"
Enter
Sleep 200ms
Show

Type "echo ''"
Enter
Type "echo '  Zero broker. Zero cloud. Zero API keys. Just tmux.'"
Enter
Type "echo '  Works with Claude Code, Pi, Cursor, Aider, or any terminal agent.'"
Enter
Type "echo ''"
Enter
Sleep 4000ms
