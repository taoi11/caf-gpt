/**
 * tests/unit/ReplyRecipients.test.ts
 *
 * Unit tests for safe reply-all recipient filtering
 *
 * Top-level declarations:
 * - ReplyRecipients test suite: Verifies authorization, deduplication, and validation
 */

import { describe, expect, it } from "vitest";
import { buildReplyAllCcRecipients } from "../../src/email/utils/ReplyRecipients";
import { APIValidationError } from "../../src/errors";
import { createMockParsedEmail } from "../mocks";

const AUTHORIZATION = {
  authorizedDomains: ["forces.gc.ca"],
  authorizedEmails: ["admin@test.com"],
};

describe("buildReplyAllCcRecipients", () => {
  it("keeps authorized CC recipients and skips self or unauthorized recipients", () => {
    const email = createMockParsedEmail({
      from: "sender@forces.gc.ca",
      cc: ["member@forces.gc.ca", "agent@caf-gpt.com", "outsider@example.com", "admin@test.com"],
    });

    const recipients = buildReplyAllCcRecipients(
      email,
      "sender@forces.gc.ca",
      ["agent@caf-gpt.com", "pacenote@caf-gpt.com"],
      AUTHORIZATION
    );

    expect(recipients).toEqual(["member@forces.gc.ca", "admin@test.com"]);
  });

  it("throws on invalid authorized-looking CC recipient", () => {
    const email = createMockParsedEmail({
      cc: ["not-an-email"],
    });

    expect(() =>
      buildReplyAllCcRecipients(email, "sender@forces.gc.ca", [], AUTHORIZATION)
    ).toThrow(APIValidationError);
  });
});
