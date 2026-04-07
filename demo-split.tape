# tresh demo -- two-pane push messaging
# Left: bob watches (push mode). Right: alice sends. Delivery is instant.

Output assets/demo-split-raw.gif
Require tmux

Set Shell bash
Set FontSize 15
Set Width 1200
Set Height 500
Set Padding 20
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms
Set CursorBlink false

# --- Hidden setup ---
Hide
  Type "rm -rf /tmp/tresh-vhs" Enter
  Sleep 300ms

  # Launch tmux (clean config, separate socket to avoid conflicts)
  Type "tmux -f /dev/null -L vhs new-session -- bash" Enter
  Sleep 1s

  # Right pane (focus stays left)
  Type "tmux split-window -d -h -- bash" Enter
  Sleep 500ms

  # Cosmetics: no status bar, dim pane borders
  Type "tmux set status off" Enter
  Sleep 200ms
  Type 'tmux setw pane-border-style "fg=8"' Enter
  Sleep 200ms
  Type 'tmux setw pane-active-border-style "fg=8"' Enter
  Sleep 200ms

  # Set up alice (right pane)
  Ctrl+B
  Type "o"
  Sleep 300ms
  Type 'export PS1="$ " TRESH_DIR=/tmp/tresh-vhs TRESH_ID=alice' Enter
  Sleep 200ms
  Type 'alias tresh="bun run src/cli.ts"' Enter
  Sleep 200ms
  Type "clear" Enter
  Sleep 300ms

  # Set up bob (left pane)
  Ctrl+B
  Type "o"
  Sleep 300ms
  Type 'export PS1="$ " TRESH_DIR=/tmp/tresh-vhs TRESH_ID=bob' Enter
  Sleep 200ms
  Type 'alias tresh="bun run src/cli.ts"' Enter
  Sleep 200ms
  Type "clear && tresh watch --push" Enter
  Sleep 1.5s

  # Switch to alice for the visible demo
  Ctrl+B
  Type "o"
  Sleep 500ms
  Ctrl+L
  Sleep 500ms
Show

# --- alice sends, bob receives instantly via push ---

Sleep 500ms

Type "tresh send bob 'hello from alice'"
Enter
Sleep 2.5s

Type "tresh send bob 'can you review PR 42?'"
Enter
Sleep 2.5s

Type "tresh send bob 'tests pass, ship it'"
Enter
Sleep 3s
