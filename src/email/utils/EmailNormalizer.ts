/**
 * src/email/utils/EmailNormalizer.ts
 *
 * Email normalization utilities for consistent address handling
 *
 * Top-level declarations:
 * - normalizeEmailAddress: Normalizes email addresses for case-insensitive comparisons
 */

import { z } from "zod";

const emailInputSchema = z.string().min(1);

// Normalize email addresses for consistent comparisons
// Handles formats: "user@domain.com", "Name <user@domain.com>", "<user@domain.com>"
export function normalizeEmailAddress(email?: string | null): string {
  const parsedEmail = emailInputSchema.safeParse(email);
  if (!parsedEmail.success) {
    return "";
  }

  const match = parsedEmail.data.match(/<([^>]+)>/);
  const extracted = match ? match[1] : parsedEmail.data;

  return extracted.toLowerCase().trim();
}
