#!/bin/bash
# Fake Claude Code prompt for demo recording. Not the real thing.
printf "\n  \033[1mClaude Code\033[0m\n\n"
while IFS= read -r -p "> " line; do
  case "$line" in
    /exit) printf "Goodbye!\n"; break ;;
    \!*) eval "${line:2}" ;;
  esac
done
