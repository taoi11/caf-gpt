/**
 * tests/unit/BaseAgent.test.ts
 *
 * Unit tests for BaseAgent OpenAI Responses provider routing
 *
 * Tests:
 * - GPT-5.6 reasoning and zero-data-retention provider options
 * - Cloudflare AI binding/Gateway transport construction
 * - Text and structured generation call options and safe logging
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createMockEnv } from "../mocks";

const { mockCreateGatewayFetch, mockCreateOpenAI, mockGenerateObject, mockGenerateText } =
  vi.hoisted(() => ({
    mockCreateGatewayFetch: vi.fn(),
    mockCreateOpenAI: vi.fn(),
    mockGenerateObject: vi.fn(),
    mockGenerateText: vi.fn(),
  }));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return { ...actual, generateObject: mockGenerateObject, generateText: mockGenerateText };
});
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: mockCreateOpenAI }));
vi.mock("workers-ai-provider/gateway", () => ({ createGatewayFetch: mockCreateGatewayFetch }));

import { BaseAgent, createModel, createProviderOptions } from "../../src/agents/utils/BaseAgent";
import { PromptManager } from "../../src/agents/utils/PromptManager";
import { createConfig } from "../../src/config";
import { Logger } from "../../src/Logger";

/** Exposes BaseAgent generation wrappers for observable logging assertions. */
class TestBaseAgent extends BaseAgent {
  /** Calls the text-generation wrapper with a supplied model identifier. */
  async callText(model: string): Promise<string> {
    return await this.callLangChain({
      model,
      promptName: "test_prompt",
      variables: { user_input: "question" },
      temperature: 0,
      maxOutputTokens: 10,
    });
  }

  /** Calls the structured-generation wrapper with a supplied model identifier. */
  async callStructured(model: string): Promise<{ answer: string }> {
    return await this.callLangChainStructured(
      {
        model,
        promptName: "test_prompt",
        variables: { user_input: "question" },
        temperature: 0,
        maxOutputTokens: 10,
      },
      z.object({ answer: z.string() }),
      "test_response"
    );
  }
}

describe("BaseAgent OpenAI Responses routing", () => {
  beforeEach(() => {
    mockCreateGatewayFetch.mockReset().mockReturnValue(vi.fn());
    mockCreateOpenAI.mockReset();
    mockGenerateObject.mockReset();
    mockGenerateText.mockReset();
  });

  it("sets high reasoning and disables response storage for GPT-5.6 Terra and Luna", () => {
    const expected = {
      openai: {
        forceReasoning: true,
        reasoningEffort: "high",
        store: false,
      },
    };

    expect(createProviderOptions("openai/gpt-5.6-terra")).toEqual(expected);
    expect(createProviderOptions("openai/gpt-5.6-luna")).toEqual(expected);
  });

  it("does not attach GPT-5.6 options to unrelated models", () => {
    expect(createProviderOptions("gpt-5.4")).toBeUndefined();
    expect(createProviderOptions("@cf/moonshotai/kimi-k2.7-code")).toBeUndefined();
  });

  it("builds an OpenAI Responses model through the Worker AI Gateway binding", () => {
    const gatewayFetch = vi.fn();
    const responsesModel = { provider: "openai.responses", modelId: "gpt-5.6-terra" };
    const responses = vi.fn(() => responsesModel);
    mockCreateGatewayFetch.mockReturnValueOnce(gatewayFetch);
    mockCreateOpenAI.mockReturnValueOnce({ responses });

    const env = createMockEnv({ AI: {} as Ai });
    const result = createModel(env, "openai/gpt-5.6-terra");

    expect(result).toBe(responsesModel);
    expect(mockCreateGatewayFetch).toHaveBeenCalledWith({
      binding: env.AI,
      gateway: "caf-gpt",
    });
    expect(mockCreateOpenAI).toHaveBeenCalledWith({
      apiKey: "unused",
      fetch: gatewayFetch,
    });
    expect(responses).toHaveBeenCalledWith("gpt-5.6-terra");
  });

  it("preserves Responses options for text and structured generation", async () => {
    const modelIdentifier = "openai/gpt-5.6-luna";
    const gatewayModel = { provider: "openai.responses", modelId: "gpt-5.6-luna" };
    mockCreateOpenAI.mockReturnValue({ responses: vi.fn(() => gatewayModel) });
    vi.spyOn(PromptManager.prototype, "renderPrompt").mockResolvedValue({
      system: "system",
      user: "question",
    });
    mockGenerateText.mockResolvedValueOnce({ text: "answer" });
    mockGenerateObject.mockResolvedValueOnce({ object: { answer: "structured" } });

    const testEnv = createMockEnv({ AI: {} as Ai });
    const agent = new TestBaseAgent(testEnv, createConfig(testEnv));

    await expect(agent.callText(modelIdentifier)).resolves.toBe("answer");
    await expect(agent.callStructured(modelIdentifier)).resolves.toEqual({ answer: "structured" });

    expect(mockGenerateText.mock.calls[0]?.[0]).toMatchObject({
      temperature: 0,
      maxOutputTokens: 10,
      providerOptions: createProviderOptions(modelIdentifier),
    });
    expect(mockGenerateObject.mock.calls[0]?.[0]).toMatchObject({
      temperature: 0,
      maxOutputTokens: 10,
      providerOptions: createProviderOptions(modelIdentifier),
    });
  });

  it("omits model fields and identifiers from all generation log contexts", async () => {
    const modelIdentifier = "openai/private-model-identifier";
    const gatewayModel = { provider: "openai.responses", modelId: "private-model-identifier" };
    mockCreateOpenAI.mockReturnValue({ responses: vi.fn(() => gatewayModel) });
    vi.spyOn(PromptManager.prototype, "renderPrompt").mockResolvedValue({
      system: "system",
      user: "question",
    });
    mockGenerateText.mockResolvedValueOnce({ text: "answer" });
    mockGenerateObject.mockResolvedValueOnce({ object: { answer: "structured" } });

    const logger = Logger.getInstance();
    const logSpies = [
      vi.spyOn(logger, "debug"),
      vi.spyOn(logger, "info"),
      vi.spyOn(logger, "warn"),
      vi.spyOn(logger, "error"),
    ];
    const testEnv = createMockEnv({ AI: {} as Ai });
    const agent = new TestBaseAgent(testEnv, createConfig(testEnv));

    await expect(agent.callText(modelIdentifier)).resolves.toBe("answer");
    await expect(agent.callStructured(modelIdentifier)).resolves.toEqual({ answer: "structured" });
    mockGenerateText.mockRejectedValueOnce(new Error("provider failed"));
    mockGenerateObject.mockRejectedValueOnce(new Error("provider failed"));
    await expect(agent.callText(modelIdentifier)).rejects.toThrow();
    await expect(agent.callStructured(modelIdentifier)).rejects.toThrow();

    const calls = logSpies.flatMap((spy) => spy.mock.calls);
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      if (call[1]) {
        expect(call[1]).not.toHaveProperty("model");
      }
    }
    expect(JSON.stringify(calls)).not.toContain(modelIdentifier);
  });
});
