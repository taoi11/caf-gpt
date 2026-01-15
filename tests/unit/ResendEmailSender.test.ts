/**
 * tests/unit/ResendEmailSender.test.ts
 *
 * Unit tests for ResendEmailSender
 *
 * Tests:
 * - Sending replies with threading headers
 * - CC list building and filtering
 * - Error responses
 * - Resend API error handling
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResendEmailSender } from "../../src/email/ResendEmailSender";
import { createMockParsedEmail } from "../mocks";

const mockSend = vi.fn();

vi.mock("resend", () => ({
  Resend: vi.fn(function MockResend() {
    return {
      emails: {
        send: mockSend,
      },
    };
  }),
}));

describe("ResendEmailSender", () => {
  let sender: ResendEmailSender;

  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({
      data: { id: "test-email-id" },
      error: null,
    });

    sender = new ResendEmailSender("re_test_key", "agent@caf-gpt.com");
  });

  describe("sendReply", () => {
    it("should send reply with threading headers", async () => {
      const originalEmail = createMockParsedEmail({
        from: "user@forces.gc.ca",
        subject: "Test Subject",
        messageId: "<original@forces.gc.ca>",
      });

      const threadingHeaders = {
        inReplyTo: "<original@forces.gc.ca>",
        references: "<original@forces.gc.ca>",
      };

      await sender.sendReply(originalEmail, "Response content", threadingHeaders, false);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "agent@caf-gpt.com",
          to: ["user@forces.gc.ca"],
          subject: "Re: Test Subject",
          text: "Response content",
          headers: {
            "In-Reply-To": "<original@forces.gc.ca>",
            References: "<original@forces.gc.ca>",
          },
        }),
        expect.objectContaining({
          idempotencyKey: "reply-<original@forces.gc.ca>",
        })
      );
    });

    it("should not add Re: prefix if subject already has it", async () => {
      const originalEmail = createMockParsedEmail({
        from: "user@forces.gc.ca",
        subject: "Re: Original Subject",
      });

      await sender.sendReply(originalEmail, "Response", {}, false);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "Re: Original Subject",
        }),
        expect.any(Object)
      );
    });

    it("should include CC recipients when includeCC is true", async () => {
      const originalEmail = createMockParsedEmail({
        from: "user@forces.gc.ca",
        to: ["agent@caf-gpt.com"],
        cc: ["cc1@forces.gc.ca", "cc2@forces.gc.ca"],
      });

      await sender.sendReply(originalEmail, "Response", {}, true);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          cc: ["cc1@forces.gc.ca", "cc2@forces.gc.ca"],
        }),
        expect.any(Object)
      );
    });

    it("should not include CC when includeCC is false", async () => {
      const originalEmail = createMockParsedEmail({
        from: "user@forces.gc.ca",
        cc: ["cc1@forces.gc.ca"],
      });

      await sender.sendReply(originalEmail, "Response", {}, false);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          cc: undefined,
        }),
        expect.any(Object)
      );
    });

    it("should omit headers when threading headers are empty", async () => {
      const originalEmail = createMockParsedEmail({
        from: "user@forces.gc.ca",
      });

      await sender.sendReply(originalEmail, "Response", {}, false);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {},
        }),
        expect.any(Object)
      );
    });

    it("should use idempotency key when messageId is present", async () => {
      const originalEmail = createMockParsedEmail({
        from: "user@forces.gc.ca",
        messageId: "<msg123@forces.gc.ca>",
      });

      await sender.sendReply(originalEmail, "Response", {}, false);

      expect(mockSend).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          idempotencyKey: "reply-<msg123@forces.gc.ca>",
        })
      );
    });

    it("should send without idempotency key when messageId is missing", async () => {
      const originalEmail = createMockParsedEmail({
        from: "user@forces.gc.ca",
        messageId: undefined,
      });

      await sender.sendReply(originalEmail, "Response", {}, false);

      expect(mockSend).toHaveBeenCalledWith(expect.any(Object), {});
    });

    it("should throw error when Resend API returns error", async () => {
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: "API Error" },
      });

      const originalEmail = createMockParsedEmail({
        from: "user@forces.gc.ca",
      });

      await expect(sender.sendReply(originalEmail, "Response", {}, false)).rejects.toThrow(
        "Resend API error: API Error"
      );
    });

    it("should throw error when Resend API throws exception", async () => {
      mockSend.mockRejectedValueOnce(new Error("Network error"));

      const originalEmail = createMockParsedEmail({
        from: "user@forces.gc.ca",
      });

      await expect(sender.sendReply(originalEmail, "Response", {}, false)).rejects.toThrow(
        "Network error"
      );
    });
  });

  describe("sendErrorResponse", () => {
    it("should send error response with generic subject", async () => {
      await sender.sendErrorResponse("user@forces.gc.ca", "Error message");

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "agent@caf-gpt.com",
          to: ["user@forces.gc.ca"],
          subject: "Error Processing Email",
          text: "Error message",
        }),
        expect.objectContaining({
          idempotencyKey: expect.stringContaining("error-user@forces.gc.ca-"),
        })
      );
    });

    it("should use unique idempotency key with timestamp", async () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now);

      await sender.sendErrorResponse("user@forces.gc.ca", "Error");

      expect(mockSend).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          idempotencyKey: `error-user@forces.gc.ca-${now}`,
        })
      );
    });

    it("should throw error when Resend API returns error", async () => {
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: "API Error" },
      });

      await expect(sender.sendErrorResponse("user@forces.gc.ca", "Error")).rejects.toThrow(
        "Resend API error: API Error"
      );
    });

    it("should throw error when Resend API throws exception", async () => {
      mockSend.mockRejectedValueOnce(new Error("Network error"));

      await expect(sender.sendErrorResponse("user@forces.gc.ca", "Error")).rejects.toThrow(
        "Network error"
      );
    });
  });

  describe("buildCCList", () => {
    it("should filter out sender's own address from CC list", async () => {
      const originalEmail = createMockParsedEmail({
        from: "user@forces.gc.ca",
        to: ["agent@caf-gpt.com"],
        cc: ["agent@caf-gpt.com", "cc1@forces.gc.ca"],
      });

      await sender.sendReply(originalEmail, "Response", {}, true);

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.cc).not.toContain("agent@caf-gpt.com");
      expect(callArgs.cc).toContain("cc1@forces.gc.ca");
    });

    it("should filter out original sender from CC list", async () => {
      const originalEmail = createMockParsedEmail({
        from: "user@forces.gc.ca",
        to: ["agent@caf-gpt.com"],
        cc: ["user@forces.gc.ca", "cc1@forces.gc.ca"],
      });

      await sender.sendReply(originalEmail, "Response", {}, true);

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.cc).not.toContain("user@forces.gc.ca");
      expect(callArgs.cc).toContain("cc1@forces.gc.ca");
    });

    it("should remove duplicate email addresses", async () => {
      const originalEmail = createMockParsedEmail({
        from: "user@forces.gc.ca",
        to: ["agent@caf-gpt.com", "cc1@forces.gc.ca"],
        cc: ["cc1@forces.gc.ca", "cc2@forces.gc.ca"],
      });

      await sender.sendReply(originalEmail, "Response", {}, true);

      const callArgs = mockSend.mock.calls[0][0];
      const ccList = callArgs.cc as string[];
      expect(ccList.filter((email) => email === "cc1@forces.gc.ca")).toHaveLength(1);
    });

    it("should truncate CC list to 49 recipients maximum", async () => {
      const ccList: string[] = [];
      for (let i = 0; i < 60; i++) {
        ccList.push(`cc${i}@forces.gc.ca`);
      }

      const originalEmail = createMockParsedEmail({
        from: "user@forces.gc.ca",
        to: ["agent@caf-gpt.com"],
        cc: ccList,
      });

      await sender.sendReply(originalEmail, "Response", {}, true);

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.cc).toHaveLength(49);
    });

    it("should handle empty CC list", async () => {
      const originalEmail = createMockParsedEmail({
        from: "user@forces.gc.ca",
        to: ["agent@caf-gpt.com"],
        cc: [],
      });

      await sender.sendReply(originalEmail, "Response", {}, true);

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.cc).toBeUndefined();
    });

    it("should normalize email addresses when filtering", async () => {
      const originalEmail = createMockParsedEmail({
        from: "User@Forces.GC.CA",
        to: ["Agent@CAF-GPT.com"],
        cc: ["user@forces.gc.ca", "CC1@Forces.GC.CA"],
      });

      await sender.sendReply(originalEmail, "Response", {}, true);

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.cc).not.toContain("user@forces.gc.ca");
      expect(callArgs.cc).toContain("cc1@forces.gc.ca");
    });
  });

  describe("Return Values", () => {
    it("should return email ID from sendReply", async () => {
      const originalEmail = createMockParsedEmail({
        from: "user@forces.gc.ca",
      });

      const result = await sender.sendReply(originalEmail, "Response", {}, false);

      expect(result).toEqual({ id: "test-email-id" });
    });

    it("should return email ID from sendErrorResponse", async () => {
      const result = await sender.sendErrorResponse("user@forces.gc.ca", "Error");

      expect(result).toEqual({ id: "test-email-id" });
    });
  });
});
