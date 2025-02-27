#!/bin/bash

PROMPT=$(<"prompt.md")

# Aider first run
aider \
  --message "$PROMPT" \
  --auto-commits \
  --no-detect-urls \
  --read "notepad/server-types-implementation.md notepad/types-implementation-plan.md notepad/server-types-summary.md notepad/server-types-mapping.md" \
  --file "src/server/types.ts" \
  --yes

# Aider second run
aider \
  --message "Double check and if needed fix the work of a code agent that was given the following instructions: $PROMPT" \
  --auto-commits \
  --no-detect-urls \
  --read "notepad/server-types-implementation.md notepad/types-implementation-plan.md notepad/server-types-summary.md notepad/server-types-mapping.md" \
  --file "src/server/types.ts" \
  --yes
