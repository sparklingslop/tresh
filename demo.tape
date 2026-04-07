# tmesh demo — send/receive round-trip
# Uses `bun run src/cli.ts` since tmesh isn't globally installed

Output assets/demo-raw.gif
Set Shell zsh
Set FontSize 15
Set Width 900
Set Height 520
Set Padding 20
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms
Set CursorBlink false

# Alias tmesh for the demo
Type "alias tmesh='bun run src/cli.ts'"
Enter
Sleep 300ms

# Identify as alice
Type "export TMESH_IDENTITY=alice"
Enter
Sleep 400ms

# Send messages to bob
Type "tmesh send bob 'hello from alice'"
Enter
Sleep 800ms

Type "tmesh send bob 'can you review PR 42?'"
Enter
Sleep 800ms

Type "tmesh send bob 'tests pass, shipping it'"
Enter
Sleep 1s

# Blank line separator
Type ""
Enter
Sleep 200ms

# Switch identity to bob
Type "export TMESH_IDENTITY=bob"
Enter
Sleep 400ms

# Read inbox
Type "tmesh inbox"
Enter
Sleep 2s

# Show consumed
Type "tmesh inbox"
Enter
Sleep 1.5s

# Discover peers
Type "tmesh ls"
Enter
Sleep 2s
