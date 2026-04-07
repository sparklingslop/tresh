# tresh demo -- bidirectional messaging with Claude Code sessions
# Left: bob. Right: alice. Terminal -> Claude Code -> terminal.

Output assets/demo-split-raw.gif
Require tmux

Set Shell bash
Set FontSize 14
Set Width 1200
Set Height 550
Set Padding 20
Set Theme "Catppuccin Mocha"
Set TypingSpeed 35ms
Set CursorBlink false

# --- Hidden setup ---
Hide
  Type "rm -rf /tmp/tresh-vhs" Enter
  Sleep 300ms

  # Launch tmux (clean config, separate socket)
  Type "tmux -f /dev/null -L vhs new-session -- bash" Enter
  Sleep 1s
  Type "tmux split-window -d -h -- bash" Enter
  Sleep 500ms

  # Cosmetics: no status bar, active border visible
  Type "tmux set status off" Enter
  Sleep 200ms
  Type 'tmux setw pane-border-style "fg=8"' Enter
  Sleep 200ms
  Type 'tmux setw pane-active-border-style "fg=12"' Enter
  Sleep 200ms

  # Set up alice (right pane)
  Ctrl+B
  Type "o"
  Sleep 300ms
  Type 'export PS1="$ " TRESH_DIR=/tmp/tresh-vhs TRESH_ID=alice' Enter
  Sleep 200ms
  Type 'tresh() { bun run src/cli.ts "$@"; }; export -f tresh' Enter
  Sleep 200ms
  Type 'alias claude-yolo="bash scripts/fake-claude.sh"' Enter
  Sleep 200ms
  Type "clear" Enter
  Sleep 300ms

  # Set up bob (left pane -- bob starts)
  Ctrl+B
  Type "o"
  Sleep 300ms
  Type 'export PS1="$ " TRESH_DIR=/tmp/tresh-vhs TRESH_ID=bob' Enter
  Sleep 200ms
  Type 'tresh() { bun run src/cli.ts "$@"; }; export -f tresh' Enter
  Sleep 200ms
  Type 'alias claude-yolo="bash scripts/fake-claude.sh"' Enter
  Sleep 200ms
  Type "clear" Enter
  Sleep 300ms
  Ctrl+L
  Sleep 500ms
Show

# ===== ACT 1: Terminal chat =====

Sleep 500ms

# Bob starts
Type "tresh send alice 'ready?'"
Enter
Sleep 2s

# Alice reads and responds
Ctrl+B
Type "o"
Sleep 800ms

Type "tresh inbox"
Enter
Sleep 1.5s

Type "tresh send bob 'yep, going claude'"
Enter
Sleep 2s

# Bob reads
Ctrl+B
Type "o"
Sleep 800ms

Type "tresh inbox"
Enter
Sleep 1.5s

# ===== ACT 2: Both launch Claude Code =====

Type "claude-yolo"
Enter
Sleep 1.5s

# Alice launches too
Ctrl+B
Type "o"
Sleep 800ms

Type "claude-yolo"
Enter
Sleep 1.5s

# ===== ACT 3: Chat inside Claude Code =====

# Switch to bob
Ctrl+B
Type "o"
Sleep 800ms

Type "! tresh send alice 'auth.ts:42 is the bug'"
Enter
Sleep 2s

# Alice reads inside Claude Code
Ctrl+B
Type "o"
Sleep 800ms

Type "! tresh inbox"
Enter
Sleep 1.5s

Type "! tresh send bob 'ship it'"
Enter
Sleep 2s

# Bob reads
Ctrl+B
Type "o"
Sleep 800ms

Type "! tresh inbox"
Enter
Sleep 1.5s

# ===== ACT 4: Exit Claude Code =====

Type "/exit"
Enter
Sleep 1s

Ctrl+B
Type "o"
Sleep 800ms

Type "/exit"
Enter
Sleep 1s

# ===== ACT 5: Terminal goodbye =====

# Switch to bob
Ctrl+B
Type "o"
Sleep 800ms

Type "tresh send alice 'later'"
Enter
Sleep 2s

# Alice reads and says bye
Ctrl+B
Type "o"
Sleep 800ms

Type "tresh inbox"
Enter
Sleep 1.5s

Type "tresh send bob 'o/'"
Enter
Sleep 2.5s
