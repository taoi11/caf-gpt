/**
 * tests/mocks/email.ts
 *
 * Mock email utilities for testing
 *
 * Top-level declarations:
 * - createMockParsedEmail: Creates mock parsed email object
 */

import type { ParsedEmailData } from "../../src/email/types";

export function createMockParsedEmail(overrides?: Partial<ParsedEmailData>): ParsedEmailData {
  const defaults: ParsedEmailData = {
    from: "test@forces.gc.ca",
    to: ["cafgpt@test.com"],
    cc: [],
    subject: "Test Subject",
    headers: {},
    body: "Test email body content.",
    messageId: "<test-123@forces.gc.ca>",
    references: "",
    date: new Date("2024-12-18T12:00:00-05:00"),
  };

  return { ...defaults, ...overrides };
}
