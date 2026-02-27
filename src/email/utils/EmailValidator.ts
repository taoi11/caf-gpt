/**
 * src/email/utils/EmailValidator.ts
 *
 * Email validation utilities
 *
 * Top-level declarations:
 * - validateEmailContent: Validate email content
 * - validateRecipients: Validate email recipients
 * - isValidEmailAddress: Validate email address format using Zod
 * - isValidMessageId: Validate Message-ID format per RFC 5322
 */

import { z } from "zod";
import type { ParsedEmailData } from "../types";

const MAX_EMAIL_BODY_LENGTH = 1_000_000;

const emailAddressSchema = z
  .string()
  .transform((val) => {
    const match = val.match(/<([^>]+)>/);
    return match ? match[1] : val;
  })
  .pipe(
    z
      .string()
      .email()
      .transform((val) => val.toLowerCase().trim())
  );

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Validate email content
export function validateEmailContent(parsedEmail: ParsedEmailData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const hasTextBody = !!parsedEmail.body && parsedEmail.body.trim().length > 0;
  const hasHtmlBody = !!parsedEmail.html && parsedEmail.html.trim().length > 0;

  // Basic structure validation
  if (!parsedEmail.from) {
    errors.push("Missing sender address");
  } else if (!isValidEmailAddress(parsedEmail.from)) {
    errors.push(`Invalid sender email format: ${parsedEmail.from}`);
  }

  if (!parsedEmail.subject) {
    warnings.push("Missing email subject");
  } else if (parsedEmail.subject.length > 200) {
    warnings.push("Subject line is unusually long");
  }

  if (!hasTextBody && !hasHtmlBody) {
    errors.push("Email body is empty");
  } else if (parsedEmail.body && parsedEmail.body.length > MAX_EMAIL_BODY_LENGTH) {
    // 1MB limit (text extracted from inbound email)
    errors.push("Email body exceeds size limit");
  } else if (parsedEmail.html && parsedEmail.html.length > MAX_EMAIL_BODY_LENGTH) {
    // 1MB limit for raw inbound HTML
    errors.push("Email HTML body exceeds size limit");
  }

  // Content security validation
  const combinedContent = `${parsedEmail.body ?? ""}\n${parsedEmail.html ?? ""}`.trim();
  if (combinedContent.length > 0 && containsSuspiciousContent(combinedContent)) {
    warnings.push("Email contains potentially suspicious content");
  }

  // Header validation
  if (parsedEmail.messageId && !isValidMessageId(parsedEmail.messageId)) {
    errors.push("Invalid Message-ID format");
  }

  if (parsedEmail.inReplyTo && !isValidMessageId(parsedEmail.inReplyTo)) {
    errors.push("Invalid In-Reply-To format");
  }

  // Date validation
  if (parsedEmail.date) {
    const now = new Date();
    const emailDate = new Date(parsedEmail.date);
    const daysDiff = (now.getTime() - emailDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff > 30) {
      warnings.push("Email is more than 30 days old");
    } else if (daysDiff < -1) {
      warnings.push("Email date is in the future");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// Validate email recipients
export function validateRecipients(to: string[], cc: string[] = []): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const allRecipients = [...to, ...cc];

  // Check for empty recipient list
  if (allRecipients.length === 0) {
    errors.push("No recipients specified");
    return { isValid: false, errors, warnings };
  }

  // Validate each recipient
  const invalidRecipients: string[] = [];
  const duplicateRecipients: string[] = [];
  const seenRecipients = new Set<string>();

  for (const recipient of allRecipients) {
    if (!recipient || typeof recipient !== "string") {
      invalidRecipients.push("empty or invalid recipient");
      continue;
    }

    const normalizedResult = emailAddressSchema.safeParse(recipient);
    if (!normalizedResult.success) {
      invalidRecipients.push(recipient);
      continue;
    }

    const normalizedRecipient = normalizedResult.data;

    if (seenRecipients.has(normalizedRecipient)) {
      duplicateRecipients.push(recipient);
    } else {
      seenRecipients.add(normalizedRecipient);
    }

    if (isSuspiciousDomain(normalizedRecipient)) {
      warnings.push(`Potentially suspicious recipient domain: ${recipient}`);
    }
  }

  if (invalidRecipients.length > 0) {
    errors.push(`Invalid recipient addresses: ${invalidRecipients.join(", ")}`);
  }

  if (duplicateRecipients.length > 0) {
    warnings.push(`Duplicate recipients: ${duplicateRecipients.join(", ")}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// Validate email address format using Zod's built-in email validator
export function isValidEmailAddress(email: string): boolean {
  if (!email || typeof email !== "string") {
    return false;
  }

  if (email.length > 254) {
    return false;
  }

  return emailAddressSchema.safeParse(email).success;
}

// Validate Message-ID format per RFC 5322: <local-part@domain>
const MESSAGE_ID_REGEX = /^<[^@]+@[^>]+>$/;

export function isValidMessageId(messageId: string): boolean {
  if (!messageId || typeof messageId !== "string") {
    return false;
  }
  return MESSAGE_ID_REGEX.test(messageId.trim());
}

// Check for suspicious content patterns
function containsSuspiciousContent(content: string): boolean {
  const suspiciousPatterns = [
    /\b(urgent|immediate|act now|limited time)\b/i,
    /\b(click here|download now|free money)\b/i,
    /\b(nigerian prince|lottery winner|inheritance)\b/i,
    /\b(phishing|malware|virus)\b/i,
  ];

  return suspiciousPatterns.some((pattern) => pattern.test(content));
}

// Check if domain is suspicious
function isSuspiciousDomain(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;

  const suspiciousDomains = [
    "tempmail.org",
    "10minutemail.com",
    "guerrillamail.com",
    "mailinator.com",
  ];

  return suspiciousDomains.includes(domain);
}
