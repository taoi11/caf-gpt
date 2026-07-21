/**
 * tests/unit/OpenAIResponsesToolLoop.test.ts
 *
 * Provider integration regression test for stateless OpenAI Responses tool continuations
 *
 * Tests:
 * - Multi-step tool continuations serialize prior function calls when response storage is disabled
 */

import { createOpenAI } from "@ai-sdk/openai";
import { generateText, stepCountIs, tool } from "ai";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createProviderOptions } from "../../src/agents/utils/BaseAgent";

/** Creates a minimal successful Responses API payload for a function call. */
function createFunctionCallResponse(): Response {
  return Response.json({
    id: "response-tool-call",
    created_at: 1_750_000_000,
    model: "gpt-5.6-luna",
    output: [
      {
        type: "function_call",
        id: "function-call-item",
        call_id: "read-file-call",
        name: "read_file",
        arguments: JSON.stringify({ file: "leave-policy.md" }),
      },
    ],
  });
}

/** Creates a minimal successful Responses API payload for the final answer. */
function createTextResponse(): Response {
  return Response.json({
    id: "response-final-answer",
    created_at: 1_750_000_001,
    model: "gpt-5.6-luna",
    output: [
      {
        type: "message",
        role: "assistant",
        id: "final-answer-item",
        phase: "final_answer",
        content: [
          {
            type: "output_text",
            text: "The policy allows it.",
            logprobs: null,
            annotations: [],
          },
        ],
      },
    ],
  });
}

describe("OpenAI Responses no-store tool loop", () => {
  it("serializes prior tool state instead of emitting an item_reference", async () => {
    const requestBodies: Array<Record<string, unknown>> = [];
    const mockFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return requestBodies.length === 1 ? createFunctionCallResponse() : createTextResponse();
    });
    const openai = createOpenAI({
      apiKey: "test-api-key",
      baseURL: "https://openai.test/v1",
      fetch: mockFetch,
    });

    const result = await generateText({
      model: openai.responses("gpt-5.6-luna"),
      prompt: "Read the leave policy.",
      temperature: 0,
      stopWhen: stepCountIs(2),
      providerOptions: createProviderOptions("openai/gpt-5.6-luna"),
      tools: {
        read_file: tool({
          inputSchema: z.object({ file: z.string() }),
          execute: async ({ file }) => ({ file, content: "Policy text" }),
        }),
      },
    });

    expect(result.text).toBe("The policy allows it.");
    expect(requestBodies).toHaveLength(2);
    expect(requestBodies[0]).toMatchObject({
      store: false,
      reasoning: { effort: "high" },
    });
    expect(requestBodies[1]).toMatchObject({
      store: false,
      reasoning: { effort: "high" },
    });

    const continuationInput = requestBodies[1]?.input as Array<Record<string, unknown>>;
    expect(continuationInput).toContainEqual({
      type: "function_call",
      id: "function-call-item",
      call_id: "read-file-call",
      name: "read_file",
      arguments: JSON.stringify({ file: "leave-policy.md" }),
    });
    expect(continuationInput).toContainEqual({
      type: "function_call_output",
      call_id: "read-file-call",
      output: JSON.stringify({ file: "leave-policy.md", content: "Policy text" }),
    });
    expect(continuationInput).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "item_reference" })])
    );
  });
});
