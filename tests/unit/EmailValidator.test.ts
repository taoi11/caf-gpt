/**
 * tests/unit/EmailValidator.test.ts
 *
 * Unit tests for email validation utilities
 *
 * Tests:
 * - Email address format validation
 * - Email content validation
 * - Recipient validation
 */

import { describe, expect, it } from "vitest";
import type { ParsedEmailData } from "../../src/email/types";
import {
  isValidEmailAddress,
  validateEmailContent,
  validateRecipients,
} from "../../src/email/utils/EmailValidator";

describe("EmailValidator", () => {
  describe("isValidEmailAddress", () => {
    it("should validate correct email addresses", () => {
      expect(isValidEmailAddress("user@forces.gc.ca")).toBe(true);
      expect(isValidEmailAddress("test.user@example.com")).toBe(true);
      expect(isValidEmailAddress("admin+tag@domain.org")).toBe(true);
    });

    it("should reject invalid email addresses", () => {
      expect(isValidEmailAddress("")).toBe(false);
      expect(isValidEmailAddress("not-an-email")).toBe(false);
    });

    it("should reject emails exceeding RFC 5321 length limit", () => {
      const longEmail = `${"a".repeat(255)}@domain.com`;
      expect(isValidEmailAddress(longEmail)).toBe(false);
    });

    it("should handle edge cases", () => {
      expect(isValidEmailAddress(null as unknown as string)).toBe(false);
      expect(isValidEmailAddress(undefined as unknown as string)).toBe(false);
      expect(isValidEmailAddress(123 as unknown as string)).toBe(false);
    });
  });

  describe("validateEmailContent", () => {
    const createValidEmail = (): ParsedEmailData => ({
      from: "sender@forces.gc.ca",
      to: ["recipient@forces.gc.ca"],
      subject: "Test Subject",
      body: "Test email body content.",
      html: undefined,
      messageId: "<test-123@forces.gc.ca>",
      date: new Date(),
      cc: [],
    });

    it("should validate a well-formed email", () => {
      const result = validateEmailContent(createValidEmail());
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject emails without sender", () => {
      const email = createValidEmail();
      email.from = "";
      const result = validateEmailContent(email);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Missing sender address");
    });

    it("should reject emails with invalid sender format", () => {
      const email = createValidEmail();
      email.from = "invalid-email";
      const result = validateEmailContent(email);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("Invalid sender email format");
    });

    it("should warn about missing subject", () => {
      const email = createValidEmail();
      email.subject = "";
      const result = validateEmailContent(email);
      expect(result.isValid).toBe(true); // Warning, not error
      expect(result.warnings).toContain("Missing email subject");
    });

    it("should warn about unusually long subject", () => {
      const email = createValidEmail();
      email.subject = "A".repeat(201);
      const result = validateEmailContent(email);
      expect(result.warnings).toContain("Subject line is unusually long");
    });

    it("should reject emails with empty body", () => {
      const email = createValidEmail();
      email.body = "   ";
      const result = validateEmailContent(email);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Email body is empty");
    });

    it("should accept HTML-only emails", () => {
      const email = createValidEmail();
      email.body = "   ";
      email.html = "<div><p>Hello</p><p>World</p></div>";
      const result = validateEmailContent(email);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject emails exceeding size limit", () => {
      const email = createValidEmail();
      email.body = "A".repeat(1000001);
      const result = validateEmailContent(email);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Email body exceeds size limit");
    });

    it("should reject emails with oversized HTML body", () => {
      const email = createValidEmail();
      email.body = "   ";
      email.html = "A".repeat(1000001);
      const result = validateEmailContent(email);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Email HTML body exceeds size limit");
    });

    it("should warn about suspicious content", () => {
      const email = createValidEmail();
      email.body = "URGENT: Click here for free money!";
      const result = validateEmailContent(email);
      expect(result.warnings).toContain("Email contains potentially suspicious content");
    });

    it("should reject invalid Message-ID format", () => {
      const email = createValidEmail();
      email.messageId = "invalid-message-id";
      const result = validateEmailContent(email);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid Message-ID format");
    });

    it("should warn about old emails", () => {
      const email = createValidEmail();
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31);
      email.date = oldDate;
      const result = validateEmailContent(email);
      expect(result.warnings).toContain("Email is more than 30 days old");
    });

    it("should warn about future dates", () => {
      const email = createValidEmail();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2);
      email.date = futureDate;
      const result = validateEmailContent(email);
      expect(result.warnings).toContain("Email date is in the future");
    });
  });

  describe("validateRecipients", () => {
    it("should validate single recipient", () => {
      const result = validateRecipients(["user@forces.gc.ca"]);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate multiple recipients", () => {
      const result = validateRecipients(
        ["user1@forces.gc.ca"],
        ["user2@forces.gc.ca", "user3@forces.gc.ca"]
      );
      expect(result.isValid).toBe(true);
    });

    it("should reject empty recipient list", () => {
      const result = validateRecipients([]);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("No recipients specified");
    });

    it("should reject invalid recipient addresses", () => {
      const result = validateRecipients(["valid@forces.gc.ca", "invalid-email"]);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("Invalid recipient addresses");
    });

    it("should warn about duplicate recipients", () => {
      const result = validateRecipients(["user@forces.gc.ca", "USER@forces.gc.ca"]);
      expect(result.warnings[0]).toContain("Duplicate recipients");
    });

    it("should warn about suspicious domains", () => {
      const result = validateRecipients(["test@tempmail.org"]);
      expect(result.warnings[0]).toContain("Potentially suspicious recipient domain");
    });

    it("should handle empty or invalid recipient entries", () => {
      const result = validateRecipients([
        "",
        null as unknown as string,
        undefined as unknown as string,
      ]);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("Invalid recipient addresses");
    });
  });
});
