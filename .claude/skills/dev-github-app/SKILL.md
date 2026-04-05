---
name: dev-github-app
description: "GitHub App bot operations for the sparklingslop org via sloppy-bot[bot]. Use this skill whenever the user mentions GitHub bot, sloppy-bot, bot comments, bot identity, @mentions on GitHub, posting as bot, reacting to issues/PRs, or managing the GitHub App. Also trigger when committing code and wanting bot attribution in Co-Authored-By trailers."
---

# dev-github-app -- sloppy-bot[bot] GitHub App Operations

Manage the `sloppy-bot` GitHub App identity for the `sparklingslop` organization. Post comments, react to @mentions, attribute commits, and interact with issues/PRs as the bot.

## Prerequisites

- GitHub App `sloppy-bot` installed on the `sparklingslop` org
- Private key stored in 1Password vault `Kai` as `sloppy-bot-github-app-key`
- App ID stored in 1Password vault `Kai` as `sloppy-bot-github-app-id`
- `gh` CLI authenticated for the sparklingslop org

## Authentication

The GitHub App uses JWT-based authentication. The flow:

1. Read the private key (.pem) and App ID from 1Password
2. Generate a JWT signed with the private key
3. Exchange the JWT for an installation access token
4. Use the token with `gh` CLI or GitHub API

### Generate Installation Token

```bash
# Get credentials from 1Password
APP_ID=$(op read "op://Kai/sloppy-bot-github-app-id/credential")
PRIVATE_KEY=$(op read "op://Kai/sloppy-bot-github-app-key/credential")

# Use the helper script
bun run .claude/skills/dev-github-app/scripts/get-token.ts
```

## Operations

### Post a Comment on an Issue/PR

```bash
# Using gh CLI with bot token
GH_TOKEN=$(bun run .claude/skills/dev-github-app/scripts/get-token.ts) \
  gh api repos/sparklingslop/tmesh/issues/1/comments \
  -f body="Comment from sloppy-bot"
```

### React to a Comment

```bash
GH_TOKEN=$(bun run .claude/skills/dev-github-app/scripts/get-token.ts) \
  gh api repos/sparklingslop/tmesh/issues/comments/COMMENT_ID/reactions \
  -f content="+1"
```

### Check for @mentions

```bash
# Search for mentions of sloppy-bot in issues/PRs
GH_TOKEN=$(bun run .claude/skills/dev-github-app/scripts/get-token.ts) \
  gh api search/issues \
  -f q="mentions:sloppy-bot[bot] org:sparklingslop is:open"
```

### Poll for New Notifications

```bash
GH_TOKEN=$(bun run .claude/skills/dev-github-app/scripts/get-token.ts) \
  gh api notifications \
  --jq '.[] | {reason, subject: .subject.title, url: .subject.url}'
```

### Commit Attribution

For commits made by or with the bot, use this Co-Authored-By trailer:

```
Co-Authored-By: sloppy-bot[bot] <APP_ID+sloppy-bot[bot]@users.noreply.github.com>
```

Replace APP_ID with the actual numeric App ID.

### List Open Issues

```bash
GH_TOKEN=$(bun run .claude/skills/dev-github-app/scripts/get-token.ts) \
  gh issue list --repo sparklingslop/tmesh --json number,title,author
```

### Create an Issue

```bash
GH_TOKEN=$(bun run .claude/skills/dev-github-app/scripts/get-token.ts) \
  gh issue create --repo sparklingslop/tmesh \
  --title "Title" --body "Body"
```

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/get-token.ts` | Generate GitHub App installation token |
| `scripts/poll-mentions.ts` | Poll for new @mentions and surface them |

## Workflow: Responding to @mentions

1. Run `poll-mentions.ts` to check for new mentions
2. For each mention, read the issue/PR context
3. Draft a response
4. Post the comment as sloppy-bot[bot]
5. React to the original comment with an appropriate reaction

## Notes

- The installation token expires after 1 hour -- scripts handle refresh automatically
- Rate limits: 5000 requests/hour for installation tokens
- Bot comments appear as `sloppy-bot[bot]` with the GitHub App badge
- Never hardcode the private key or App ID -- always read from 1Password
