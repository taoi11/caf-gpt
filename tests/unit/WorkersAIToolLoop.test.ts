/**
 * tests/unit/WorkersAIToolLoop.test.ts
 *
 * Native Workers AI transport regression coverage using the real AI SDK and provider.
 *
 * Top-level declarations:
 * - configuredModels: Default agent models whose routing is verified at the binding boundary
 * - native Workers AI suite: Checks explicit reasoning, tools, and stateless continuations
 */

import { generateText, stepCountIs, tool } from "ai";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createModel, createProviderOptions } from "../../src/agents/utils/BaseAgent";
import { createConfig } from "../../src/config";
import { createMockEnv } from "../mocks";

const configuredModels = Object.entries(createConfig().llm.models);

describe("native Workers AI model routing and tool loop", () => {
  it.each(
    configuredModels
  )("routes %s with high reasoning and round-trips typed tools", async (agent, config) => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "tool_calls",
            message: {
              role: "assistant",
              content: "",
              reasoning_content: "Read the policy first.",
              tool_calls: [
                {
                  id: "read-policy",
                  type: "function",
                  function: {
                    name: "read_file",
                    arguments: JSON.stringify({ file: "leave-policy.md" }),
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "stop",
            message: { role: "assistant", content: "The policy allows it." },
          },
        ],
      });

    const env = createMockEnv();
    Object.assign(env.AI, { run });

    const readFile = vi.fn(async ({ file }: { file: string }) => ({
      file,
      content: "Policy text",
    }));

    const result = await generateText({
      model: createModel(env, config.model),
      providerOptions: createProviderOptions(config.model),
      prompt: "Read the leave policy.",
      temperature: config.temperature,
      maxOutputTokens: config.maxOutputTokens,
      stopWhen: stepCountIs(2),
      tools: {
        read_file: tool({
          inputSchema: z.object({ file: z.string() }),
          execute: readFile,
        }),
      },
    });

    expect(result.text).toBe("The policy allows it.");
    expect(readFile).toHaveBeenCalledOnce();
    expect(readFile.mock.calls[0]?.[0]).toEqual({ file: "leave-policy.md" });
    expect(run).toHaveBeenCalledTimes(2);

    for (const [model, inputs, options] of run.mock.calls) {
      expect(model).toBe(
        agent === "primeFoo" ? "@cf/zai-org/glm-5.3" : "@cf/zai-org/glm-5.3-flash"
      );
      expect(inputs).toMatchObject({
        reasoning_effort: "high",
        temperature: 0,
        max_tokens: 16384,
        tools: [
          {
            type: "function",
            function: {
              name: "read_file",
              parameters: expect.objectContaining({ type: "object", required: ["file"] }),
            },
          },
        ],
      });
      expect(inputs.stream).not.toBe(true);
      expect(options).toMatchObject({ gateway: { id: "caf-gpt" } });
      expect(options).not.toHaveProperty("reasoning_effort");
    }

    expect(run.mock.calls[1]?.[1].messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          reasoning: "Read the policy first.",
          tool_calls: [
            {
              id: "read-policy",
              type: "function",
              function: {
                name: "read_file",
                arguments: JSON.stringify({ file: "leave-policy.md" }),
              },
            },
          ],
        }),
        expect.objectContaining({
          role: "tool",
          tool_call_id: "read-policy",
          content: JSON.stringify({ file: "leave-policy.md", content: "Policy text" }),
        }),
      ])
    );
  });
});
