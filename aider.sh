#!/bin/bash

PROMPT_FILE="prompt.md"

# Check if prompt file exists and read its content
if [ ! -f "$PROMPT_FILE" ]; then
  echo "Error: Prompt file $PROMPT_FILE not found!" >&2
  exit 1
fi

PROMPT=$(<"$PROMPT_FILE")
LOGS=$(<"notepad/logs.txt")

# Aider first run
aider \
  --message "$PROMPT Logs: $LOGS" \
  --yes \
  --read notepade/logs_temp src/emails/*.py src/llm/*.py src/utils/*.py \

# Aider second run
# aider \
#   --message " Double check and fix the work of a code agent that was given the following instructions: $PROMPT Logs: $LOGS" \~
#   --yes \
#   --read notepade/logs_temp \
#   --file src/emails/*.py src/llm/*.py src/utils/*.py 
