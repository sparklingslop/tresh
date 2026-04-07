# tmesh demo — send/receive round-trip

Output assets/demo-raw.gif
Set Shell zsh
Set FontSize 15
Set Width 900
Set Height 500
Set Padding 20
Set Theme "Catppuccin Mocha"
Set TypingSpeed 50ms
Set CursorBlink false

# Title
Type "# tmesh — zero-polling agent mesh"
Enter
Sleep 800ms

# Identify as alice
Type "export TMESH_IDENTITY=alice"
Enter
Sleep 400ms

# Send messages to bob
Type "tmesh send bob 'hello from alice'"
Enter
Sleep 800ms

Type "tmesh send bob 'can you review PR #42?'"
Enter
Sleep 800ms

Type "tmesh send bob 'tests pass — shipping it'"
Enter
Sleep 1s

# Switch to bob
Type ""
Enter
Type "# Now let's be bob and check the inbox"
Enter
Sleep 600ms

Type "export TMESH_IDENTITY=bob"
Enter
Sleep 400ms

# Read inbox
Type "tmesh inbox"
Enter
Sleep 2s

# Show it's consumed
Type "tmesh inbox"
Enter
Sleep 1.5s

# Discover peers
Type ""
Enter
Type "# See who's on the mesh"
Enter
Sleep 400ms
Type "tmesh ls"
Enter
Sleep 2s
