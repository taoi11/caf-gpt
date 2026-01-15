/**
 * tests/mocks/llm.ts
 *
 * Mock LLM response patterns for testing agents
 *
 * Top-level declarations:
 * - MOCK_RESPONSES: Common LLM response patterns for Prime Foo agent
 */

// Common LLM response patterns for Prime Foo agent (JSON format)
export const MOCK_RESPONSES = {
  // Simple reply
  reply: (text: string) =>
    JSON.stringify({
      type: "reply",
      reply: text,
    }),

  // Research request
  research: (agentName: string, query: string) =>
    JSON.stringify({
      type: "research",
      research: {
        sub_agent: agentName,
        queries: [{ query: query }],
      },
    }),

  // Feedback note request
  feedbackNote: (rank: string, context: string) =>
    JSON.stringify({
      type: "feedback_note",
      feedbackNote: {
        rank: rank,
        context: context,
      },
    }),

  // No response needed
  noResponse: JSON.stringify({ type: "no_response" }),

  // Invalid JSON (for error testing)
  invalidJson: `{ "type": "reply", "reply": "Missing closing brace"`,
};
