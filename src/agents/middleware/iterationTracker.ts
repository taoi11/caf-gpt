/**
 * src/agents/middleware/iterationTracker.ts
 *
 * Middleware-compatible helper for tracking tool call iterations
 *
 * Top-level declarations:
 * - ToolLimitMessage: Message payload used when the tool call limit is exceeded
 * - iterationTrackerMiddleware: Wrapper exposing wrapToolCall for tool call limiting
 * - resetToolCallCount: Resets the current tool call counter
 */

import { Logger } from "../../Logger";

export class ToolLimitMessage {
  constructor(
    public content: string,
    public tool_call_id: string
  ) {}
}

interface ToolCallRequest {
  toolCall: { id?: string };
}

const logger = Logger.getInstance();
let toolCallCount = 0;

export const iterationTrackerMiddleware = {
  name: "IterationTracker",
  wrapToolCall: async (
    request: ToolCallRequest,
    handler: (request: ToolCallRequest) => Promise<unknown>
  ) => {
    toolCallCount++;
    const maxCalls = 3;

    logger.info("Tool call tracked", { toolCallCount, maxCalls });

    if (toolCallCount > maxCalls) {
      return new ToolLimitMessage(
        `Research limit reached (${maxCalls} tool calls maximum). Please compose your final response using the information gathered so far.`,
        request.toolCall.id || "unknown"
      );
    }

    return handler(request);
  },
};

export function resetToolCallCount() {
  toolCallCount = 0;
}
