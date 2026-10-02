/**
 * src/agents/utils/ClefDecision.ts
 *
 * Thin Clef-flash decision helpers for hot-path gates (reply vs no_reply, memory update vs not)
 *
 * Top-level declarations:
 * - CLEF_FLASH_MODEL: Workers AI model id for Clef-flash
 * - CLEF_REPLY_CONFIDENCE_THRESHOLD: Minimum choice confidence for affirmative reply gate
 * - CLEF_MEMORY_UPDATE_CONFIDENCE_THRESHOLD: Minimum choice confidence for affirmative memory-update gate
 * - ClefAiRunner: Injectable AI.run surface for unit tests
 * - ReplyGateDecision: Result of the inbound reply vs no_reply gate
 * - MemoryUpdateGateDecision: Result of the scheduled memory update vs no_update gate
 * - isRecord: Type guard for plain object records
 * - parseChoiceAnswer: Parses a Clef choice answer from an unknown payload
 * - decideShouldReply: Asks Clef-flash whether CAF-GPT should reply; propagates AI.run failures
 * - decideShouldUpdateMemory: Asks Clef-flash whether MemoryFoo should run; propagates AI.run failures
 */

/** Workers AI model id used for latency-critical decision gates. */
export const CLEF_FLASH_MODEL = "@cf/cloudflare/clef-flash" as const;

/**
 * Minimum `confidence` (0–1) required to honor `choice === "reply"`.
 * Below this (or any malformed answer when Clef responded) we fail closed to no_reply.
 */
export const CLEF_REPLY_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Minimum `confidence` (0–1) required to honor `choice === "update"`.
 * Below this (or any malformed answer when Clef responded) we fail closed to no_update.
 */
export const CLEF_MEMORY_UPDATE_CONFIDENCE_THRESHOLD = 0.6;

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

/** Outcome of the scheduled memory update gate. */
export interface MemoryUpdateGateDecision {
  shouldUpdate: boolean;
  choice?: "update" | "no_update";
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
    should_update_memory?: unknown;
  };
}

const SHOULD_REPLY_QUESTION = {
  type: "choice" as const,
  instructions:
    'Should CAF-GPT send a reply to this inbound email? Prefer no_reply for FYI, spam-like noise, thanks-only, or nothing actionable. CAF-GPT handles CAF policy questions and CAF PACE/feedback-note requests (including mail to pacenote@caf-gpt.com). Short contextual follow-ups (e.g. "Yes, please") warrant reply when <memory> supplies prior context.',
  criteria: {
    reply:
      "A substantive reply is warranted — policy/QRO/DOAD/leave help, or a PACE/feedback-note request",
    no_reply: "Silent drop — do not reply",
  },
};

const SHOULD_UPDATE_MEMORY_QUESTION = {
  type: "choice" as const,
  instructions:
    "Should CAF-GPT update this user's persistent memory after this email exchange? Prefer no_update for routine Q&A with no new durable user facts, preferences, or interaction patterns. Prefer update when the exchange reveals new work context, preferences, focus areas, or lasting patterns worth personalizing future replies.",
  criteria: {
    update: "Run MemoryFoo to edit the user's memory narrative",
    no_update: "Skip MemoryFoo — leave memory unchanged",
  },
};

/** Returns true when value is a non-null plain object (not an array). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parses a Clef choice answer from an unknown payload.
 * @param value - Raw Clef choice answer value from Clef-flash
 * @returns Parsed choice answer, or null when malformed
 */
function parseChoiceAnswer(value: unknown): ClefChoiceAnswer | null {
  if (!isRecord(value)) return null;
  if (value.type !== "choice") return null;
  if (typeof value.choice !== "string" || value.choice.length === 0) return null;
  if (typeof value.confidence !== "number" || !Number.isFinite(value.confidence)) return null;
  if (value.confidence < 0 || value.confidence > 1) return null;
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

/**
 * Ask Clef-flash whether a successful reply exchange warrants a MemoryFoo update.
 * Propagates AI.run failures (outages/timeouts) so scheduled retries can run.
 * Fail-closed to shouldUpdate false only for a valid no_update choice, or malformed/low-confidence when Clef answered.
 * @param ai - Injectable Workers AI runner
 * @param emailContext - Inbound email context string
 * @param agentReply - Outbound agent reply text that was sent
 * @param memory - Optional current user memory included in Clef state
 */
export async function decideShouldUpdateMemory(
  ai: ClefAiRunner,
  emailContext: string,
  agentReply: string,
  memory?: string
): Promise<MemoryUpdateGateDecision> {
  const trimmedMemory = memory?.trim() ?? "";
  const memoryBlock = trimmedMemory.length > 0 ? `<memory>\n${trimmedMemory}\n</memory>\n\n` : "";
  const state = `${memoryBlock}<user_email>
${emailContext}
</user_email>

<agent_reply>
${agentReply}
</agent_reply>`;

  const raw = await ai.run(CLEF_FLASH_MODEL, {
    model: "clef-flash",
    state,
    questions: {
      should_update_memory: SHOULD_UPDATE_MEMORY_QUESTION,
    },
  });

  if (!isRecord(raw)) {
    return { shouldUpdate: false, reason: "clef_malformed_response" };
  }

  const response = raw as ClefFlashResponse;
  const answer = parseChoiceAnswer(response.answers?.should_update_memory);
  if (!answer) {
    return { shouldUpdate: false, reason: "clef_malformed_answer" };
  }

  if (answer.choice !== "update" && answer.choice !== "no_update") {
    return {
      shouldUpdate: false,
      confidence: answer.confidence,
      reason: "clef_unknown_choice",
    };
  }

  if (answer.choice !== "update") {
    return {
      shouldUpdate: false,
      choice: "no_update",
      confidence: answer.confidence,
      reason: "clef_no_update",
    };
  }

  if (answer.confidence < CLEF_MEMORY_UPDATE_CONFIDENCE_THRESHOLD) {
    return {
      shouldUpdate: false,
      choice: "update",
      confidence: answer.confidence,
      reason: "clef_low_confidence",
    };
  }

  return {
    shouldUpdate: true,
    choice: "update",
    confidence: answer.confidence,
    reason: "clef_update",
  };
}
