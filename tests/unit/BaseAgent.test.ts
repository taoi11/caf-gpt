/**
 * tests/unit/BaseAgent.test.ts
 *
 * Unit tests for BaseAgent provider routing utilities
 *
 * Tests:
 * - Cloudflare Unified Billing provider options for Gemini models
 * - Provider selection for Cloudflare Unified models
 * - TestBaseAgent: Exposes protected generation wrappers for logging-contract tests
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createMockEnv } from "../mocks";

const { mockCreateAiGateway, mockCreateUnified, mockGenerateObject, mockGenerateText } = vi.hoisted(
  () => ({
    mockCreateAiGateway: vi.fn(),
    mockCreateUnified: vi.fn(),
    mockGenerateObject: vi.fn(),
    mockGenerateText: vi.fn(),
  })
);

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return { ...actual, generateObject: mockGenerateObject, generateText: mockGenerateText };
});
vi.mock("ai-gateway-provider", () => ({
  createAiGateway: mockCreateAiGateway,
}));
vi.mock("ai-gateway-provider/providers/unified", () => ({
  createUnified: mockCreateUnified,
}));

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

describe("BaseAgent provider routing", () => {
  beforeEach(() => {
    mockCreateAiGateway.mockReset();
    mockCreateUnified.mockReset();
    mockGenerateObject.mockReset();
    mockGenerateText.mockReset();
  });

  it("should enable Cloudflare Unified flex options for Gemini models", () => {
    expect(createProviderOptions("google-ai-studio/gemini-3.1-flash-lite-preview")).toMatchObject({
      Unified: {
        service_tier: "flex",
      },
    });
  });

  it("should enable high reasoning for OpenAI GPT-5 models", () => {
    expect(createProviderOptions("openai/gpt-5.4")).toEqual({
      Unified: {
        reasoningEffort: "high",
      },
    });
    expect(createProviderOptions("openai/gpt-5.4-mini")).toEqual({
      Unified: {
        reasoningEffort: "high",
      },
    });
  });

  it("should not attach Cloudflare Unified Billing options to Cloudflare native models", () => {
    expect(createProviderOptions("@cf/moonshotai/kimi-k2.7-code")).toBeUndefined();
  });

  it("should route Gemini models through Cloudflare AI Gateway Unified Billing", () => {
    const gatewayModel = { provider: "gateway", modelId: "wrapped" };
    const unifiedModel = {
      provider: "Unified.chat",
      modelId: "google-ai-studio/gemini-3.1-flash-lite-preview",
    };
    const mockUnified = vi.fn(() => unifiedModel);
    mockCreateAiGateway.mockReturnValueOnce(vi.fn(() => gatewayModel));
    mockCreateUnified.mockReturnValueOnce(mockUnified);

    const env = createMockEnv();
    const result = createModel(env, "google-ai-studio/gemini-3.1-flash-lite-preview");

    expect(result).toBe(gatewayModel);
    expect(mockCreateUnified).toHaveBeenCalledWith({ supportsStructuredOutputs: true });
    expect(mockUnified).toHaveBeenCalledWith("google-ai-studio/gemini-3.1-flash-lite-preview");
  });

  it("should route Cloudflare native models through the Unified provider", () => {
    const gatewayModel = { provider: "gateway", modelId: "wrapped" };
    const unifiedModel = { provider: "Unified.chat", modelId: "@cf/model" };
    const mockUnified = vi.fn(() => unifiedModel);
    mockCreateAiGateway.mockReturnValueOnce(vi.fn(() => gatewayModel));
    mockCreateUnified.mockReturnValueOnce(mockUnified);

    const env = createMockEnv();
    const result = createModel(env, "@cf/moonshotai/kimi-k2.7-code");

    expect(result).toBe(gatewayModel);
    expect(mockCreateUnified).toHaveBeenCalledWith({ supportsStructuredOutputs: false });
    expect(mockUnified).toHaveBeenCalledWith("@cf/moonshotai/kimi-k2.7-code");
  });

  it("omits model fields and identifiers from all generation log contexts", async () => {
    const modelIdentifier = "private-provider/private-model-identifier";
    const gatewayModel = { provider: "gateway", modelId: "wrapped" };
    mockCreateAiGateway.mockReturnValue(vi.fn(() => gatewayModel));
    mockCreateUnified.mockReturnValue(vi.fn((model: string) => model));
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
    const testEnv = createMockEnv();
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
