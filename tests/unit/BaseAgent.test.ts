/**
 * tests/unit/BaseAgent.test.ts
 *
 * Unit tests for BaseAgent provider routing utilities
 *
 * Tests:
 * - Cloudflare Unified Billing provider options for Gemini models
 * - Provider selection for Cloudflare Unified models
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockEnv } from "../mocks";

const { mockCreateAiGateway, mockCreateUnified } = vi.hoisted(() => ({
  mockCreateAiGateway: vi.fn(),
  mockCreateUnified: vi.fn(),
}));

vi.mock("ai-gateway-provider", () => ({
  createAiGateway: mockCreateAiGateway,
}));
vi.mock("ai-gateway-provider/providers/unified", () => ({
  createUnified: mockCreateUnified,
}));

import { createModel, createProviderOptions } from "../../src/agents/utils/BaseAgent";

describe("BaseAgent provider routing", () => {
  beforeEach(() => {
    mockCreateAiGateway.mockReset();
    mockCreateUnified.mockReset();
  });

  it("should enable Cloudflare Unified flex options for Gemini models", () => {
    expect(createProviderOptions("google-ai-studio/gemini-3.1-flash-lite-preview")).toMatchObject({
      Unified: {
        service_tier: "flex",
      },
    });
  });

  it("should not attach Cloudflare Unified Billing options to Workers AI models", () => {
    expect(createProviderOptions("workers-ai/@cf/moonshotai/kimi-k2.5")).toBeUndefined();
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

  it("should route Workers AI models through the Unified provider", () => {
    const gatewayModel = { provider: "gateway", modelId: "wrapped" };
    const unifiedModel = { provider: "Unified.chat", modelId: "workers-ai/model" };
    const mockUnified = vi.fn(() => unifiedModel);
    mockCreateAiGateway.mockReturnValueOnce(vi.fn(() => gatewayModel));
    mockCreateUnified.mockReturnValueOnce(mockUnified);

    const env = createMockEnv();
    const result = createModel(env, "workers-ai/@cf/moonshotai/kimi-k2.5");

    expect(result).toBe(gatewayModel);
    expect(mockCreateUnified).toHaveBeenCalledWith({ supportsStructuredOutputs: false });
    expect(mockUnified).toHaveBeenCalledWith("workers-ai/@cf/moonshotai/kimi-k2.5");
  });
});
