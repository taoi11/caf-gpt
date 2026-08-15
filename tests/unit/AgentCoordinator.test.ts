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

import { AgentCoordinator } from "../../src/agents/AgentCoordinator";
import { createConfig } from "../../src/config";
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
