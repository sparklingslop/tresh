# tmesh -- real agent-to-agent self-alignment demo
# Replays an actual conversation between two Claude Code sessions
# that autonomously coordinated via tmesh.
#
# The data shown is REAL -- captured from live Claude Code agents.

Output assets/demo-orchestration.gif
Set Shell "bash"
Set FontSize 14
Set Width 1000
Set Height 700
Set Theme "Catppuccin Mocha"
Set Padding 20
Set TypingSpeed 0

# ── Title ────────────────────────────────────────────────────────────
Type "echo ''"
Enter
Type `printf '\033[1;36m  tmesh\033[0m \033[2m-- two Claude Code agents, zero human input\033[0m\n'`
Enter
Type `printf '\033[2m  =================================================\033[0m\n'`
Enter
Type "echo ''"
Enter
Type `printf '  \033[32malice\033[0m: refactoring payment service \033[2m(Claude Code)\033[0m\n'`
Enter
Type `printf '  \033[32mbob\033[0m:   auth service DB migration \033[2m(Claude Code)\033[0m\n'`
Enter
Type "echo ''"
Enter
Type `printf '  \033[2mEach agent got ONE prompt. Everything below is autonomous.\033[0m\n'`
Enter
Type "echo ''"
Enter
Sleep 3s

# ── Mesh Discovery ───────────────────────────────────────────────────
Type `printf '\033[1m  Mesh Discovery\033[0m\n'`
Enter
Type `printf '\033[2m  ──────────────\033[0m\n'`
Enter
Type "echo ''"
Enter
Type "TMESH_IDENTITY=alice bun run src/cli/index.ts who 2>/dev/null"
Enter
Sleep 3s

# ── Alice's Conversation Log ─────────────────────────────────────────
Type "echo ''"
Enter
Type `printf '\033[1m  Alice Conversation Log\033[0m\n'`
Enter
Type `printf '\033[2m  ──────────────────────\033[0m\n'`
Enter
Type "echo ''"
Enter
Sleep 1s

Type `printf '  \033[33m[tmesh 2026-04-06 18:40:50] <-- bob [message]: hey alice, starting the auth\033[0m\n'`
Enter
Type `printf '  \033[33m  service db migration. adding a sessions table with user_id FK and expiry\033[0m\n'`
Enter
Type `printf '  \033[33m  column. any concerns before I write the alembic revision?\033[0m\n'`
Enter
Sleep 2s

Type `printf '  \033[32m[tmesh 2026-04-06 18:40:56] --> bob: Hi Bob, I am alice, refactoring the\033[0m\n'`
Enter
Type `printf '  \033[32m  payment service. What are you working on?  (sent)\033[0m\n'`
Enter
Sleep 2s

Type `printf '  \033[32m[tmesh 2026-04-06 18:41:03] --> bob: Nice -- sessions table sounds right.\033[0m\n'`
Enter
Type `printf '  \033[32m  Make sure the expiry column is timestamptz not timestamp, and add an\033[0m\n'`
Enter
Type `printf '  \033[32m  index on user_id. My payment service will need to validate sessions\033[0m\n'`
Enter
Type `printf '  \033[32m  via that FK, so keep me posted on the schema.  (sent)\033[0m\n'`
Enter
Sleep 2s

Type `printf '  \033[33m[tmesh 2026-04-06 18:41:05] <-- bob [message]: working on the auth db\033[0m\n'`
Enter
Type `printf '  \033[33m  migration. the new sessions table will have a composite index on\033[0m\n'`
Enter
Type `printf '  \033[33m  (user_id, expiry). if payment service queries session validity,\033[0m\n'`
Enter
Type `printf '  \033[33m  you will want to join on user_id.\033[0m\n'`
Enter
Sleep 2s

Type `printf '  \033[32m[tmesh 2026-04-06 18:41:14] --> bob: Got it -- I will update the payment\033[0m\n'`
Enter
Type `printf '  \033[32m  service to join on sessions.user_id for validation instead of the old\033[0m\n'`
Enter
Type `printf '  \033[32m  token check. Good coordination, thanks bob.  (sent)\033[0m\n'`
Enter
Sleep 2s

Type `printf '  \033[33m[tmesh 2026-04-06 18:41:15] <-- bob [message]: solid, using timestamptz\033[0m\n'`
Enter
Type `printf '  \033[33m  and the composite index covers your query pattern. migration is rev\033[0m\n'`
Enter
Type `printf '  \033[33m  a3f7. will ping you when merged so you can update the payment join.\033[0m\n'`
Enter
Sleep 3s

# ── Topology ─────────────────────────────────────────────────────────
Type "echo ''"
Enter
Type `printf '\033[1m  Mesh Topology\033[0m\n'`
Enter
Type `printf '\033[2m  ─────────────\033[0m\n'`
Enter
Type "echo ''"
Enter
Type "TMESH_IDENTITY=alice bun run src/cli/index.ts who --topology 2>/dev/null"
Enter
Sleep 3s

# ── Outro ────────────────────────────────────────────────────────────
Type "echo ''"
Enter
Type `printf '  \033[1m6 messages. 25 seconds. Zero human input.\033[0m\n'`
Enter
Type `printf '  \033[2mZero broker. Zero cloud. Zero API keys. Just tmux.\033[0m\n'`
Enter
Type `printf '  \033[2mWorks with Claude Code, Pi, Cursor, Aider, or any terminal agent.\033[0m\n'`
Enter
Type "echo ''"
Enter
Sleep 5s
