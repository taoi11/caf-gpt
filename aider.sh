#!/bin/bash

PROMPT=$(<"prompt.md")

# Aider first run
aider \
  --message "$PROMPT" \
  --auto-commits \
  --no-detect-urls \
  --read "src/server/types.ts" \
  --read ".appLogic/policyFoo.md" \
  --read "src/server/index.ts" \
  --file "src/server/api/policyFoo/policyFoo.ts" \
  --file "src/server/api/policyFoo/doad/doad.ts" \
  --file "src/server/api/policyFoo/doad/agents/doadChat.ts" \
  --file "src/server/api/policyFoo/doad/agents/doadFinder.ts" \
  --yes

# Aider second run
aider \
  --message "Double check and IF needed (not looking for perfection) fix the work of a code agent that was given the following instructions: $PROMPT" \
  --auto-commits \
  --no-detect-urls \
  --read "src/server/types.ts" \
  --read "src/server/index.ts" \
  --read ".appLogic/policyFoo.md" \
  --file "src/server/api/policyFoo/policyFoo.ts" \
  --file "src/server/api/policyFoo/doad/doad.ts" \
  --file "src/server/api/policyFoo/doad/agents/doadChat.ts" \
  --file "src/server/api/policyFoo/doad/agents/doadFinder.ts" \
  --yes
