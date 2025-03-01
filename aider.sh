#!/bin/bash

PROMPT=$(<"prompt.md")

# Aider first run
aider \
  --message "$PROMPT" \
  --auto-commits \
  --no-detect-urls \
  --read "src/server/types.ts" \
  --file "src/server/utils/config.ts" \
  --file "src/server/utils/logger.ts" \
  --file "src/server/utils/costTracker.ts" \
  --file "src/server/utils/llmGateway.ts" \
  --file "src/server/utils/rateLimiter.ts" \
  --file "src/server/utils/s3Client.ts" \
  --file "src/server/index.ts" \
  --yes

# Aider second run
aider \
  --message "Double check and IF needed (not looking for perfection) fix the work of a code agent that was given the following instructions: $PROMPT" \
  --auto-commits \
  --no-detect-urls \
  --read "src/server/types.ts" \
  --file "src/server/utils/config.ts" \
  --file "src/server/utils/logger.ts" \
  --file "src/server/utils/costTracker.ts" \
  --file "src/server/utils/llmGateway.ts" \
  --file "src/server/utils/rateLimiter.ts" \
  --file "src/server/utils/s3Client.ts" \
  --file "src/server/index.ts" \
  --yes
