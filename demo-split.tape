# tresh demo -- send/receive with push messaging

Output assets/demo-split-raw.gif
Set Shell zsh
Set FontSize 15
Set Width 900
Set Height 550
Set Padding 20
Set Theme "Catppuccin Mocha"
Set TypingSpeed 35ms
Set CursorBlink false

# Setup
Type "alias tresh='bun run src/cli.ts'"
Enter
Sleep 300ms
Type "export TRESH_DIR=/tmp/tresh-demo"
Enter
Sleep 300ms
Type "rm -rf /tmp/tresh-demo"
Enter
Sleep 300ms
Type "clear"
Enter
Sleep 500ms

# Alice sends messages
Type "export TRESH_ID=alice"
Enter
Sleep 500ms

Type "tresh send bob 'hello from alice'"
Enter
Sleep 1s

Type "tresh send bob 'review PR 42?'"
Enter
Sleep 1s

Type "tresh send bob 'tests pass, ship it'"
Enter
Sleep 1.5s

# Blank line
Type ""
Enter
Sleep 300ms

# Bob reads inbox
Type "export TRESH_ID=bob"
Enter
Sleep 500ms

Type "tresh inbox"
Enter
Sleep 2.5s

# Show consumed
Type "tresh inbox"
Enter
Sleep 1.5s

# Check mesh
Type "tresh ls"
Enter
Sleep 2.5s
