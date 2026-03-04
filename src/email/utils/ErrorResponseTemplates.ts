/**
 * src/email/utils/ErrorResponseTemplates.ts
 *
 * Error response templates for email reply failures
 *
 * Top-level declarations:
 * - ErrorResponseTemplate: Template definition for error response messages
 * - ERROR_RESPONSE_TEMPLATES: Ordered templates used to select response text
 */

import {
  AgentCreditsExhaustedError,
  AgentError,
  EmailCompositionError,
  EmailParsingError,
  EmailThreadingError,
  EmailValidationError,
  StorageError,
} from "../../errors";

export type ErrorResponseTemplate = {
  match: (error: unknown) => boolean;
  lines: string[];
};

export const ERROR_RESPONSE_TEMPLATES: ErrorResponseTemplate[] = [
  {
    match: (error) => error instanceof EmailParsingError,
    lines: [
      "Well, that is embarrassing. I couldn't read your email cleanly.",
      "Could you resend it? If it keeps happening, please contact support.",
    ],
  },
  {
    match: (error) => error instanceof EmailThreadingError,
    lines: [
      "I tripped over the email threading. Your message made it, but the reply formatting might look a little wonky.",
    ],
  },
  {
    match: (error) => error instanceof EmailCompositionError,
    lines: [
      "I tried to write a reply and face-planted. Classic me.",
      "Please try again, or contact support if it keeps happening.",
    ],
  },
  {
    match: (error) => error instanceof EmailValidationError,
    lines: [
      "I am picky about email formats and I seem to have rejected yours.",
      "Please double-check the content and try again.",
    ],
  },
  {
    match: (error) => error instanceof AgentCreditsExhaustedError,
    lines: [
      "Tragically, the AI credits given by Big AI have run out for this month.",
      "Come back after the monthly reset next month.",
    ],
  },
  {
    match: (error) => error instanceof AgentError,
    lines: [
      "The AI gears slipped while I was handling your request.",
      "Please try again in a moment.",
    ],
  },
  {
    match: (error) => error instanceof StorageError,
    lines: [
      "I went to grab some data and the storage cupboard was locked.",
      "Please try again in a moment.",
    ],
  },
  {
    match: () => true,
    lines: ["Something went sideways on my end while processing your email.", "Please try again."],
  },
];
