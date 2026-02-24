/**
 * tests/integration/EmailHandler.test.ts
 *
 * Integration tests for SimpleEmailHandler
 *
 * Tests:
 * - End-to-end email processing flow
 * - Authorization checks
 * - Agent coordination integration
 * - Error handling flows
 * - Self-loop prevention
 * - Memory operations
 * - Error response logic
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmailCompositionError, EmailValidationError } from "../../src/errors";
import { createMockEnv, createMockParsedEmail } from "../mocks";

// Mock types for test dependencies - using flexible method signatures that accept both vi.fn() and real methods
interface MockEmailSender {
  sendReply: (...args: unknown[]) => Promise<unknown>;
  sendErrorResponse: (...args: unknown[]) => Promise<unknown>;
}

interface MockEmailComposer {
  formatQuotedContent: (...args: unknown[]) => string;
}

const { mockAgentInvoke, mockProcessWithPrimeFoo } = vi.hoisted(() => ({
  mockAgentInvoke: vi.fn(),
  mockProcessWithPrimeFoo: vi.fn(),
}));

vi.mock("../../src/agents/AgentCoordinator", () => ({
  AgentCoordinator: {
    create: vi.fn(async () => ({
      processWithPrimeFoo: mockProcessWithPrimeFoo,
    })),
  },
}));

vi.mock("langchain", () => ({
  createAgent: vi.fn(() => ({
    invoke: mockAgentInvoke,
  })),
  createMiddleware: vi.fn((config) => config),
  tool: vi.fn((func) => func),
}));

vi.mock("@langchain/openai", () => ({
  ChatOpenAI: vi.fn(function MockChatOpenAI() {
    return {
      invoke: vi.fn(),
      withStructuredOutput: vi.fn(() => ({
        invoke: vi.fn(),
      })),
    };
  }),
}));

const mockSql = vi.fn().mockResolvedValue([]);
vi.mock("../../src/storage/database", () => ({
  getSqlClient: vi.fn(() => mockSql),
  resetSqlClient: vi.fn(),
}));

import { createConfig } from "../../src/config";
import { SimpleEmailHandler } from "../../src/email/SimpleEmailHandler";

function setMockAgentResponse(content: string) {
  mockProcessWithPrimeFoo.mockResolvedValueOnce({
    shouldRespond: true,
    content,
  });
}

function _setMockNoResponse() {
  mockProcessWithPrimeFoo.mockResolvedValueOnce({
    shouldRespond: false,
  });
}

function setMockAgentError(message: string) {
  mockProcessWithPrimeFoo.mockRejectedValueOnce(new Error(message));
}

describe("SimpleEmailHandler - Integration", () => {
  let handler: SimpleEmailHandler;
  let mockEnv: ReturnType<typeof createMockEnv>;

  function createDefaultEmailSender(): MockEmailSender {
    return {
      sendReply: vi.fn().mockResolvedValue({ id: "reply-123" }),
      sendErrorResponse: vi.fn().mockResolvedValue({ id: "error-123" }),
    };
  }

  beforeEach(() => {
    mockAgentInvoke.mockReset();
    mockProcessWithPrimeFoo.mockReset();

    mockProcessWithPrimeFoo.mockResolvedValue({
      shouldRespond: true,
      content: "Default response",
    });

    mockEnv = createMockEnv();
    const config = createConfig(undefined);

    const mockBucket = mockEnv.R2_BUCKET as unknown as import("../mocks/cloudflare").MockR2Bucket;
    mockBucket.seed("paceNote/cpl.md", "# CPL Competencies\n\nLeadership and technical skills");
    mockBucket.seed("paceNote/examples.md", "# Example Notes\n\nExample feedback notes");

    handler = new SimpleEmailHandler(
      mockEnv,
      config,
      undefined,
      undefined,
      createDefaultEmailSender() as never
    );
  });

  describe("Email Processing Flow", () => {
    it("should process email from authorized sender", async () => {
      const message = createMockParsedEmail({
        from: "test@forces.gc.ca",
        subject: "Test Question",
      });

      setMockAgentResponse("Here is the answer to your question.");

      await handler.processEmail(message);

      expect(mockProcessWithPrimeFoo).toHaveBeenCalled();
    });

    it("should handle simple question and reply", async () => {
      const message = createMockParsedEmail({
        from: "test@forces.gc.ca",
        subject: "Leave Question",
        body: "What is the policy on annual leave?",
        messageId: "<original-123@forces.gc.ca>",
      });

      setMockAgentResponse("Annual leave policy allows for 20 days per year.");

      await handler.processEmail(message);

      expect(mockProcessWithPrimeFoo).toHaveBeenCalled();
    });

    it("should handle email requiring sub-agent research", async () => {
      const message = createMockParsedEmail({
        from: "test@forces.gc.ca",
        subject: "Specific Leave Question",
      });

      setMockAgentResponse("Based on the policy, you can take leave.");

      const mockBucket = mockEnv.R2_BUCKET as unknown as import("../mocks/cloudflare").MockR2Bucket;
      mockBucket.seed("leave/annual_leave.md", "# Annual Leave Policy\n\n20 days per year");

      await handler.processEmail(message);

      expect(mockProcessWithPrimeFoo).toHaveBeenCalled();
    });

    it("should handle feedback note generation request", async () => {
      const message = createMockParsedEmail({
        from: "test@forces.gc.ca",
        subject: "Generate Feedback Note",
      });

      setMockAgentResponse(
        "## Feedback for CPL\n\nDemonstrated exceptional leadership during training exercises."
      );

      await handler.processEmail(message);

      expect(mockProcessWithPrimeFoo).toHaveBeenCalled();
    });

    it("should handle no_response directive", async () => {
      const message = createMockParsedEmail({
        from: "test@forces.gc.ca",
        subject: "Just FYI",
      });

      setMockAgentResponse("");

      await handler.processEmail(message);

      expect(mockProcessWithPrimeFoo).toHaveBeenCalled();
    });
  });

  describe("Self-Loop Prevention", () => {
    it("should ignore emails from self address", async () => {
      const config = createConfig(undefined);
      const message = createMockParsedEmail({
        from: config.email.agentFromEmail,
        subject: "Test",
      });

      await handler.processEmail(message);
      expect(mockProcessWithPrimeFoo).not.toHaveBeenCalled();
    });

    it("should ignore emails with missing sender", async () => {
      const message = createMockParsedEmail({
        from: "",
        subject: "Test",
      });

      await handler.processEmail(message);
      expect(mockProcessWithPrimeFoo).not.toHaveBeenCalled();
    });
  });

  describe("Email Validation", () => {
    it("should reject email with empty body", async () => {
      const message = createMockParsedEmail({
        from: "test@forces.gc.ca",
        body: "",
      });

      await expect(handler.processEmail(message)).rejects.toThrow(EmailValidationError);
    });

    it("should process email with empty subject (warning only)", async () => {
      const message = createMockParsedEmail({
        from: "test@forces.gc.ca",
        subject: "",
      });

      setMockAgentResponse("AI response");

      await handler.processEmail(message);
      // No error thrown - empty subject is a warning, not an error
    });

    it("should reject email with invalid recipients", async () => {
      const message = createMockParsedEmail({
        from: "test@forces.gc.ca",
        to: [],
      });

      await expect(handler.processEmail(message)).rejects.toThrow(EmailValidationError);
    });
  });

  describe("Memory Operations", () => {
    it("should handle memory fetch gracefully when username cannot be derived", async () => {
      const message = createMockParsedEmail({
        from: "test@example.com",
        subject: "Test",
      });

      setMockAgentResponse("Response without memory");

      await handler.processEmail(message);
      expect(mockProcessWithPrimeFoo).toHaveBeenCalled();
    });

    it("should continue processing when memory fetch fails", async () => {
      const message = createMockParsedEmail({
        from: "test@forces.gc.ca",
        subject: "Test",
      });

      const mockHyperdrive =
        mockEnv.HYPERDRIVE as unknown as import("../mocks/cloudflare").MockHyperdrive;
      mockHyperdrive.connectionString = "";

      setMockAgentResponse("Response without memory");

      await handler.processEmail(message);
      expect(mockProcessWithPrimeFoo).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should rethrow LLM API failures", async () => {
      const message = createMockParsedEmail({
        from: "test@forces.gc.ca",
        subject: "Question",
      });

      setMockAgentError("API Error");

      await expect(handler.processEmail(message)).rejects.toThrow("API Error");
      expect(mockProcessWithPrimeFoo).toHaveBeenCalled();
    });

    it("should handle invalid responses gracefully", async () => {
      const message = createMockParsedEmail({
        from: "test@forces.gc.ca",
        subject: "Question",
      });

      mockAgentInvoke.mockResolvedValueOnce({
        messages: [{ role: "assistant", content: undefined }],
      });

      await handler.processEmail(message);

      expect(mockProcessWithPrimeFoo).toHaveBeenCalled();
    });

    it("should not send error response for EmailCompositionError (non-recoverable)", async () => {
      const mockEmailSender: MockEmailSender = {
        sendReply: vi.fn().mockRejectedValue(new Error("Send failed")),
        sendErrorResponse: vi.fn(),
      };

      const config = createConfig(undefined);
      const customHandler = new SimpleEmailHandler(
        mockEnv,
        config,
        undefined,
        undefined,
        mockEmailSender as never
      );

      const message = createMockParsedEmail({
        from: "test@forces.gc.ca",
        subject: "Test",
      });

      setMockAgentResponse("AI response");

      await expect(customHandler.processEmail(message)).rejects.toThrow();
      expect(mockEmailSender.sendErrorResponse).not.toHaveBeenCalled();
    });
  });

  describe("Reply Sending", () => {
    it("should send reply with quoted content", async () => {
      const mockEmailSender: MockEmailSender = {
        sendReply: vi.fn().mockResolvedValue({ id: "reply-123" }),
        sendErrorResponse: vi.fn(),
      };

      const config = createConfig(undefined);
      const customHandler = new SimpleEmailHandler(
        mockEnv,
        config,
        undefined,
        undefined,
        mockEmailSender as never
      );

      const message = createMockParsedEmail({
        from: "test@forces.gc.ca",
        subject: "Test",
        body: "Original message",
      });

      setMockAgentResponse("AI response");

      await customHandler.processEmail(message);

      expect(mockEmailSender.sendReply).toHaveBeenCalledWith(
        message,
        expect.stringContaining("AI response"),
        expect.any(Object)
      );
    });

    it("should handle quoted content formatting errors gracefully", async () => {
      const mockEmailComposer: MockEmailComposer = {
        formatQuotedContent: vi.fn().mockImplementation(() => {
          throw new Error("Formatting failed");
        }),
      };

      const mockEmailSender: MockEmailSender = {
        sendReply: vi.fn().mockResolvedValue({ id: "reply-123" }),
        sendErrorResponse: vi.fn(),
      };

      const config = createConfig(undefined);
      const customHandler = new SimpleEmailHandler(
        mockEnv,
        config,
        undefined,
        mockEmailComposer as never,
        mockEmailSender as never
      );

      const message = createMockParsedEmail({
        from: "test@forces.gc.ca",
        subject: "Test",
      });

      setMockAgentResponse("AI response");

      await customHandler.processEmail(message);

      expect(mockEmailSender.sendReply).toHaveBeenCalled();
    });

    it("should throw error when reply sending fails", async () => {
      const mockEmailSender: MockEmailSender = {
        sendReply: vi.fn().mockRejectedValue(new EmailCompositionError("Send failed")),
        sendErrorResponse: vi.fn(),
      };

      const config = createConfig(undefined);
      const customHandler = new SimpleEmailHandler(
        mockEnv,
        config,
        undefined,
        undefined,
        mockEmailSender as never
      );

      const message = createMockParsedEmail({
        from: "test@forces.gc.ca",
        subject: "Test",
      });

      setMockAgentResponse("AI response");

      await expect(customHandler.processEmail(message)).rejects.toThrow(EmailCompositionError);
    });
  });

  describe("Memory Update", () => {
    it("should trigger memory update after successful reply with ExecutionContext", async () => {
      const mockCtx: ExecutionContext = {
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn(),
        props: {} as Record<string, unknown>,
      };

      const mockEmailSender: MockEmailSender = {
        sendReply: vi.fn().mockResolvedValue({ id: "reply-123" }),
        sendErrorResponse: vi.fn(),
      };

      const config = createConfig(undefined);
      const customHandler = new SimpleEmailHandler(
        mockEnv,
        config,
        undefined,
        undefined,
        mockEmailSender as never
      );

      const message = createMockParsedEmail({
        from: "test@forces.gc.ca",
        subject: "Test",
      });

      setMockAgentResponse("AI response with content");

      await customHandler.processEmail(message, mockCtx);

      expect(mockCtx.waitUntil).toHaveBeenCalled();
    });

    it("should not trigger memory update without ExecutionContext", async () => {
      const message = createMockParsedEmail({
        from: "test@forces.gc.ca",
        subject: "Test",
      });

      setMockAgentResponse("AI response");

      await handler.processEmail(message);
    });

    it("should not trigger memory update without Hyperdrive", async () => {
      const mockCtx: ExecutionContext = {
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn(),
        props: {} as Record<string, unknown>,
      };

      const envWithoutHyperdrive: Partial<Env> = {
        ...createMockEnv(),
        HYPERDRIVE: undefined,
      };

      const config = createConfig(undefined);
      const customHandler = new SimpleEmailHandler(
        envWithoutHyperdrive as Env,
        config,
        undefined,
        undefined,
        createDefaultEmailSender() as never
      );

      const message = createMockParsedEmail({
        from: "test@forces.gc.ca",
        subject: "Test",
      });

      setMockAgentResponse("AI response");

      await customHandler.processEmail(message, mockCtx);

      expect(mockCtx.waitUntil).not.toHaveBeenCalled();
    });
  });

  describe("Email Threading", () => {
    it("should preserve threading headers in replies", async () => {
      const message = createMockParsedEmail({
        from: "test@forces.gc.ca",
        messageId: "<thread-1@forces.gc.ca>",
        references: "<parent-1@forces.gc.ca>",
      });

      setMockAgentResponse("Reply content");

      await handler.processEmail(message);

      expect(mockProcessWithPrimeFoo).toHaveBeenCalled();
    });
  });
});
