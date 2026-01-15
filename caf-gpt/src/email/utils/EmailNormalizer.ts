/**
 * src/email/utils/EmailNormalizer.ts
 *
 * Email normalization utilities for consistent address handling
 *
 * Top-level declarations:
 * - normalizeEmailAddress: Normalizes email addresses for case-insensitive comparisons
 */

// Normalize email addresses for consistent comparisons
// Handles formats: "user@domain.com", "Name <user@domain.com>", "<user@domain.com>"
export function normalizeEmailAddress(email?: string | null): string {
  if (!email || typeof email !== "string") {
    return "";
  }

  const match = email.match(/<([^>]+)>/);
  const extracted = match ? match[1] : email;

  return extracted.toLowerCase().trim();
}
