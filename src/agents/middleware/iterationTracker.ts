/**
 * src/agents/middleware/iterationTracker.ts
 *
 * Middleware for tracking tool call iterations in LangChain agents
 *
 * Top-level declarations:
 * - iterationTrackerMiddleware: Middleware that tracks and limits tool calls
 */

import { ToolMessage } from "@langchain/core/messages";
import { createMiddleware } from "langchain";
import { Logger } from "../../Logger";

const logger = Logger.getInstance();
let toolCallCount = 0;

export const iterationTrackerMiddleware = createMiddleware({
  name: "IterationTracker",

  wrapToolCall: async (request, handler) => {
    toolCallCount++;
    const maxCalls = 3;

    logger.info("Tool call tracked", { toolCallCount, maxCalls });

    if (toolCallCount > maxCalls) {
      return new ToolMessage({
        content: `Research limit reached (${maxCalls} tool calls maximum). Please compose your final response using the information gathered so far.`,
        tool_call_id: request.toolCall.id || "unknown",
      });
    }

    return handler(request);
  },
});

export function resetToolCallCount() {
  toolCallCount = 0;
}
