/**
 * tests/unit/AgentCoordinator.test.ts
 *
 * Unit tests for Prime Foo coordinator failure logging
 *
 * Top-level declarations:
 * - AgentCoordinator failure logging suite: Verifies safe AI API metadata classification
 * - Prime Foo tool error mapping suite: Verifies tool failures reach the reply boundary honestly
 * - Prime Foo fail-loudly suite: Verifies a failed tool call ends generation after one step
 */

import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, generateText } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockEnv } from "../mocks";

import { AgentCoordinator, toPrimeFooToolError } from "../../src/agents/AgentCoordinator";
import { DoadFooAgent } from "../../src/agents/sub-agents/DoadFooAgent";
import { createConfig } from "../../src/config";
import {
  AgentAPIError,
  AgentValidationError,
  StorageConnectionError,
  StorageNotFoundError,
} from "../../src/errors";
import { Logger } from "../../src/Logger";

const mockGenerateText = vi.fn();
const testModel = createOpenAI({ apiKey: "unused" }).responses("test");
const createTestModel = vi.fn(() => testModel);

describe("AgentCoordinator failure logging", () => {
  beforeEach(() => {
    mockGenerateText.mockReset();
  });

  it("passes ZDR-safe Responses options to the Prime Foo tool loop", async () => {
    mockGenerateText.mockResolvedValueOnce({ text: "answer", steps: [] });
    const testEnv = createMockEnv();

    const coordinator = await AgentCoordinator.create(testEnv, createConfig(testEnv), {
      createModel: createTestModel,
      generateText: mockGenerateText,
    });

    await expect(coordinator.processWithPrimeFoo("safe context")).resolves.toMatchObject({
      content: expect.stringContaining("answer"),
      shouldRespond: true,
    });

    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "high",
            store: false,
          },
        },
      })
    );
  });

  it("logs only safe API call status metadata for AI_APICallError", async () => {
    const sensitiveValue = "sensitive prompt and response content";

    const apiError = new APICallError({
      message: sensitiveValue,
      url: "https://gateway.example/sensitive-model-id",
      requestBodyValues: { prompt: sensitiveValue },
      statusCode: 503,
      responseHeaders: { "x-sensitive": sensitiveValue },
      responseBody: sensitiveValue,
      cause: new Error(sensitiveValue),
      isRetryable: true,
    });

    mockGenerateText.mockRejectedValueOnce(apiError);
    const loggerError = vi.spyOn(Logger.getInstance(), "error");
    const testEnv = createMockEnv();

    const coordinator = await AgentCoordinator.create(testEnv, createConfig(testEnv), {
      createModel: createTestModel,
      generateText: mockGenerateText,
    });

    await expect(coordinator.processWithPrimeFoo("safe context")).rejects.toBe(apiError);

    const failureCall = loggerError.mock.calls.find(
      ([message]) => message === "Prime_foo processing failed"
    );

    expect(failureCall).toBeDefined();
    expect(failureCall?.[1]).toEqual({
      processingTime: expect.any(Number),
      errorName: "AI_APICallError",
      statusCode: 503,
      isRetryable: true,
    });
    expect(JSON.stringify(failureCall)).not.toContain(sensitiveValue);
    expect(JSON.stringify(failureCall)).not.toContain("sensitive-model-id");
  });

  it("does not add API call status metadata to a non-APICallError", async () => {
    const ordinaryError = Object.assign(new Error("ordinary sensitive failure"), {
      statusCode: 418,
      isRetryable: false,
    });

    mockGenerateText.mockRejectedValueOnce(ordinaryError);
    const loggerError = vi.spyOn(Logger.getInstance(), "error");
    const testEnv = createMockEnv();

    const coordinator = await AgentCoordinator.create(testEnv, createConfig(testEnv), {
      createModel: createTestModel,
      generateText: mockGenerateText,
    });

    await expect(coordinator.processWithPrimeFoo("safe context")).rejects.toBe(ordinaryError);

    const failureCall = loggerError.mock.calls.find(
      ([message]) => message === "Prime_foo processing failed"
    );

    expect(failureCall).toBeDefined();
    expect(failureCall?.[1]).toEqual({
      processingTime: expect.any(Number),
      errorName: "Error",
    });
    expect(failureCall?.[1]).not.toHaveProperty("statusCode");
    expect(failureCall?.[1]).not.toHaveProperty("isRetryable");
  });
});

describe("Prime Foo tool error mapping", () => {
  beforeEach(() => {
    mockGenerateText.mockReset();
  });

  it("passes app errors through so the reply names the real cause", () => {
    const storage = new StorageConnectionError("r2 down");

    const shortlist = new AgentValidationError(
      "DOAD policy Clef shortlist failed: clef_invalid_choice"
    );

    expect(toPrimeFooToolError(storage)).toBe(storage);
    expect(toPrimeFooToolError(shortlist)).toBe(shortlist);
  });

  it("maps Workers AI binding failures to AgentAPIError", () => {
    for (const name of ["InferenceUpstreamError", "AiInternalError"]) {
      const upstream = new Error("5006: bad input");
      upstream.name = name;
      expect(toPrimeFooToolError(upstream)).toBeInstanceOf(AgentAPIError);
    }
  });

  it("keeps unknown tool failures as AgentValidationError", () => {
    expect(toPrimeFooToolError(new TypeError("boom"))).toBeInstanceOf(AgentValidationError);
    expect(toPrimeFooToolError("not an error")).toBeInstanceOf(AgentValidationError);
  });

  it("rethrows the tool's own StorageError instead of a generic validation error", async () => {
    const storage = new StorageNotFoundError("Document not found");
    mockGenerateText.mockResolvedValueOnce({
      text: "",
      steps: [{ content: [{ type: "tool-error", toolName: "batch_research", error: storage }] }],
    });
    const testEnv = createMockEnv();

    const coordinator = await AgentCoordinator.create(testEnv, createConfig(testEnv), {
      createModel: createTestModel,
      generateText: mockGenerateText,
    });

    await expect(coordinator.processWithPrimeFoo("safe context")).rejects.toBe(storage);
  });
});

describe("Prime Foo fail-loudly on tool errors", () => {
  const usage = {
    inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 1, text: 1, reasoning: 0 },
  };

  /** One model step that asks for batch_research with a DOAD question. */
  function researchStep() {
    return {
      content: [
        {
          type: "tool-call" as const,
          toolCallId: `call-${crypto.randomUUID()}`,
          toolName: "batch_research",
          input: JSON.stringify({ doad_queries: ["What does the DOAD say?"] }),
        },
      ],
      finishReason: { unified: "tool-calls" as const, raw: undefined },
      usage,
      warnings: [],
    };
  }

  /** Model that always asks for batch_research, so any re-call would show as an extra step. */
  function alwaysResearchModel() {
    return new MockLanguageModelV3({ doGenerate: async () => researchStep() });
  }

  it("stops after the first failed batch_research step with no re-calls", async () => {
    const model = alwaysResearchModel();

    const failure = new AgentValidationError(
      "DOAD policy Clef shortlist failed: clef_empty_shortlist"
    );

    const research = vi.spyOn(DoadFooAgent.prototype, "research").mockRejectedValue(failure);
    const testEnv = createMockEnv();

    const coordinator = await AgentCoordinator.create(testEnv, createConfig(testEnv), {
      createModel: () => model,
      generateText,
    });

    await expect(coordinator.processWithPrimeFoo("safe context")).rejects.toBe(failure);
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(research).toHaveBeenCalledTimes(1);
    research.mockRestore();
  });

  it("still continues to the answer step after a successful tool call", async () => {
    const answerStep = {
      content: [{ type: "text" as const, text: "Here is the answer." }],
      finishReason: { unified: "stop" as const, raw: undefined },
      usage,
      warnings: [],
    };

    let modelCalls = 0;

    const model = new MockLanguageModelV3({
      doGenerate: async () => {
        modelCalls += 1;

        return modelCalls === 1 ? researchStep() : answerStep;
      },
    });

    const research = vi.spyOn(DoadFooAgent.prototype, "research").mockResolvedValue("DOAD answer");
    const testEnv = createMockEnv();

    const coordinator = await AgentCoordinator.create(testEnv, createConfig(testEnv), {
      createModel: () => model,
      generateText,
    });

    const response = await coordinator.processWithPrimeFoo("safe context");
    expect(response.shouldRespond).toBe(true);
    expect(response.content).toContain("Here is the answer.");
    expect(model.doGenerateCalls).toHaveLength(2);
    research.mockRestore();
  });
});
