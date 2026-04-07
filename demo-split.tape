# tresh demo -- push vs poll modes (quick VHS version)
# Left: bob (push). Right: alice (poll). Shows the delivery difference.
# For the full demo with real Claude Code, use: ./scripts/demo-split.sh --record

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

  # Cosmetics
  Type "tmux set status off" Enter
  Sleep 200ms
  Type 'tmux setw pane-border-style "fg=8"' Enter
  Sleep 200ms
  Type 'tmux setw pane-active-border-style "fg=12"' Enter
  Sleep 200ms

  # Alice (right pane)
  Ctrl+B
  Type "o"
  Sleep 300ms
  Type 'export PS1="$ " TRESH_DIR=/tmp/tresh-vhs TRESH_ID=alice' Enter
  Sleep 200ms
  Type 'tresh() { bun run src/cli.ts "$@"; }; export -f tresh' Enter
  Sleep 200ms
  Type "clear" Enter
  Sleep 300ms

  # Bob (left pane)
  Ctrl+B
  Type "o"
  Sleep 300ms
  Type 'export PS1="$ " TRESH_DIR=/tmp/tresh-vhs TRESH_ID=bob' Enter
  Sleep 200ms
  Type 'tresh() { bun run src/cli.ts "$@"; }; export -f tresh' Enter
  Sleep 200ms
  Type "clear" Enter
  Sleep 300ms
  Ctrl+L
  Sleep 500ms
Show

# ===== PUSH MODE: bob watches, alice sends =====

Sleep 500ms

# Bob starts watching with push (zero-CPU block)
Type "tresh watch --push"
Enter
Sleep 1.5s

# Switch to alice -- she sends messages
Ctrl+B
Type "o"
Sleep 800ms

Type "tresh send bob 'hello from alice'"
Enter
Sleep 2.5s

Type "tresh send bob 'push is instant'"
Enter
Sleep 2.5s

# Bob stops watching
Ctrl+B
Type "o"
Sleep 500ms
Ctrl+C
Sleep 500ms

# ===== POLL MODE: alice watches, bob sends =====

# Switch to alice -- she watches with poll
Ctrl+B
Type "o"
Sleep 500ms

Type "tresh watch --poll 2000"
Enter
Sleep 1.5s

# Bob sends -- alice gets it after poll interval
Ctrl+B
Type "o"
Sleep 500ms

Type "tresh send alice 'and poll works too'"
Enter
Sleep 4s

# Alice stops watching
Ctrl+B
Type "o"
Sleep 500ms
Ctrl+C
Sleep 500ms

# ===== Quick send/inbox round-trip =====

# Bob sends
Ctrl+B
Type "o"
Sleep 500ms

Type "tresh send alice 'later!'"
Enter
Sleep 2s

# Alice reads one-shot
Ctrl+B
Type "o"
Sleep 500ms

Type "tresh inbox"
Enter
Sleep 2s

Type "tresh send bob 'o/'"
Enter
Sleep 2.5s
