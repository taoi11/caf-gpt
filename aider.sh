#!/bin/bash

PROMPT=$(<"prompt.md")

# Aider first run
aider \
  --message "$PROMPT" \
  --auto-commits \
  --no-detect-urls \
  --read src/types.py \
  --file src/**/*.py \
  --yes

# Aider second run
aider \
  --message "Double check and fix the work of a code agent that was given the following instructions: $PROMPT" \
  --auto-commits \
  --no-detect-urls \
  --read src/types.py \
  --file src/**/*.py \
  --yes
