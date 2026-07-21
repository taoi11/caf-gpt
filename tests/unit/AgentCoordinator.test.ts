/**
 * tests/unit/AgentCoordinator.test.ts
 *
 * Unit tests for Prime Foo coordinator failure logging
 *
 * Top-level declarations:
 * - AgentCoordinator failure logging suite: Verifies safe AI API metadata classification
 */

import { APICallError } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockEnv } from "../mocks";

const { mockGenerateText } = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return { ...actual, generateText: mockGenerateText };
});

vi.mock("../../src/agents/utils/BaseAgent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/agents/utils/BaseAgent")>();
  return { ...actual, createModel: vi.fn(() => ({ provider: "test", modelId: "test" })) };
});

import { AgentCoordinator } from "../../src/agents/AgentCoordinator";
import { createConfig } from "../../src/config";
import { Logger } from "../../src/Logger";

describe("AgentCoordinator failure logging", () => {
  beforeEach(() => {
    mockGenerateText.mockReset();
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
    const coordinator = await AgentCoordinator.create(testEnv, createConfig(testEnv));

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
    const coordinator = await AgentCoordinator.create(testEnv, createConfig(testEnv));

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
