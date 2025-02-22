#!/bin/bash

PROMPT=$(<"prompt.md")
LOGS=$(<"notepad/logs.txt")

# Aider first run
aider \
  --message "$PROMPT" \
  --read notepad/email_prep_brainstorm.md \
  --file src/emails/*.py src/llm/*.py src/utils/*.py \
  --yes

# Aider second run
aider \
  --message "Double check and fix the work of a code agent that was given the following instructions: $PROMPT" \
  --read notepad/email_prep_brainstorm.md \
  --file src/emails/*.py src/llm/*.py src/utils/*.py \
  --yes
