/**
 * src/agents/utils/ClefDecision.ts
 *
 * Thin Clef-flash decision helpers for hot-path gates (reply vs no_reply)
 *
 * Top-level declarations:
 * - CLEF_FLASH_MODEL: Workers AI model id for Clef-flash
 * - CLEF_REPLY_CONFIDENCE_THRESHOLD: Minimum choice confidence to allow a reply (fail-closed below)
 * - ClefAiRunner: Injectable AI.run surface for unit tests
 * - ReplyGateDecision: Result of the inbound reply vs no_reply gate
 * - isRecord: Type guard for plain object records
 * - parseChoiceAnswer: Parses a Clef choice answer from an unknown payload
 * - decideShouldReply: Asks Clef-flash whether CAF-GPT should reply; propagates AI.run failures
 */

/** Workers AI model id used for latency-critical decision gates. */
export const CLEF_FLASH_MODEL = "@cf/cloudflare/clef-flash" as const;

/**
 * Minimum `confidence` (0–1) required to honor `choice === "reply"`.
 * Below this (or any malformed answer when Clef responded) we fail closed to no_reply.
 */
export const CLEF_REPLY_CONFIDENCE_THRESHOLD = 0.6;

/** Injectable Workers AI runner used so unit tests can mock `AI.run` without Env. */
export interface ClefAiRunner {
  run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
}

/** Outcome of the inbound email reply gate. */
export interface ReplyGateDecision {
  shouldReply: boolean;
  choice?: "reply" | "no_reply";
  confidence?: number;
  reason: string;
}

interface ClefChoiceAnswer {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
}

interface ClefFlashResponse {
  answers?: {
    should_reply?: unknown;
  };
}

const SHOULD_REPLY_QUESTION = {
  type: "choice" as const,
  instructions:
    "Should CAF-GPT send a reply to this inbound email? Prefer no_reply for FYI, spam-like noise, thanks-only, or nothing actionable for a CAF policy assistant. Short contextual follow-ups (e.g. \"Yes, please\") warrant reply when <memory> supplies prior context.",
  criteria: {
    reply: "A substantive reply is warranted",
    no_reply: "Silent drop — do not reply",
  },
};

/** Returns true when value is a non-null plain object (not an array). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parses a Clef choice answer from an unknown payload.
 * @param value - Raw `answers.should_reply` value from Clef-flash
 * @returns Parsed choice answer, or null when malformed
 */
function parseChoiceAnswer(value: unknown): ClefChoiceAnswer | null {
  if (!isRecord(value)) return null;
  if (value.type !== "choice") return null;
  if (typeof value.choice !== "string" || value.choice.length === 0) return null;
  if (typeof value.confidence !== "number" || !Number.isFinite(value.confidence)) return null;
  if (!isRecord(value.probabilities)) return null;
  return {
    type: "choice",
    choice: value.choice,
    confidence: value.confidence,
    probabilities: value.probabilities as Record<string, number>,
  };
}

/**
 * Ask Clef-flash whether an inbound email warrants a reply.
 * Propagates AI.run failures (outages/timeouts) to the caller error boundary.
 * Fail-closed to shouldReply false only for a valid no_reply choice, or malformed/low-confidence when Clef answered.
 * @param ai - Injectable Workers AI runner
 * @param emailContext - Inbound email context string
 * @param memory - Optional user memory included in Clef state for contextual short replies
 */
export async function decideShouldReply(
  ai: ClefAiRunner,
  emailContext: string,
  memory?: string
): Promise<ReplyGateDecision> {
  const trimmedMemory = memory?.trim() ?? "";
  const state =
    trimmedMemory.length > 0
      ? `<memory>\n${trimmedMemory}\n</memory>\n\n${emailContext}`
      : emailContext;

  const raw = await ai.run(CLEF_FLASH_MODEL, {
    model: "clef-flash",
    state,
    questions: {
      should_reply: SHOULD_REPLY_QUESTION,
    },
  });

  if (!isRecord(raw)) {
    return { shouldReply: false, reason: "clef_malformed_response" };
  }

  const response = raw as ClefFlashResponse;
  const answer = parseChoiceAnswer(response.answers?.should_reply);
  if (!answer) {
    return { shouldReply: false, reason: "clef_malformed_answer" };
  }

  if (answer.choice !== "reply" && answer.choice !== "no_reply") {
    return {
      shouldReply: false,
      confidence: answer.confidence,
      reason: "clef_unknown_choice",
    };
  }

  if (answer.choice !== "reply") {
    return {
      shouldReply: false,
      choice: "no_reply",
      confidence: answer.confidence,
      reason: "clef_no_reply",
    };
  }

  if (answer.confidence < CLEF_REPLY_CONFIDENCE_THRESHOLD) {
    return {
      shouldReply: false,
      choice: "reply",
      confidence: answer.confidence,
      reason: "clef_low_confidence",
    };
  }

  return {
    shouldReply: true,
    choice: "reply",
    confidence: answer.confidence,
    reason: "clef_reply",
  };
}
