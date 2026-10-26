/**
 * tests/unit/AgentCoordinator.test.ts
 *
 * Unit tests for Prime Foo coordinator failure logging
 *
 * Top-level declarations:
 * - AgentCoordinator failure logging suite: Verifies safe AI API metadata classification
 */

import { createOpenAI } from "@ai-sdk/openai";
import { APICallError } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockEnv } from "../mocks";

import { AgentCoordinator, toPrimeFooToolError } from "../../src/agents/AgentCoordinator";
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
