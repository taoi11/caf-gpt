/**
 * src/agents/utils/ClefDecision.ts
 *
 * Thin Clef-flash decision helpers for hot-path gates (reply vs no_reply, memory update vs not)
 * and DOAD/QR&O manifest shortlisting
 *
 * Top-level declarations:
 * - CLEF_FLASH_MODEL: Workers AI model id for Clef-flash
 * - CLEF_REPLY_CONFIDENCE_THRESHOLD: Minimum choice confidence for affirmative reply gate
 * - CLEF_MEMORY_UPDATE_CONFIDENCE_THRESHOLD: Minimum choice confidence for affirmative memory-update gate
 * - CLEF_SHORTLIST_CONFIDENCE_THRESHOLD: Minimum choice confidence to accept a shortlist pick
 * - CLEF_SHORTLIST_MAX_PICKS: Default maximum documents to shortlist
 * - ClefAiRunner: Injectable AI.run surface for unit tests
 * - ReplyGateDecision: Result of the inbound reply vs no_reply gate
 * - MemoryUpdateGateDecision: Result of the scheduled memory update vs no_update gate
 * - ManifestShortlistDecision: Result of the DOAD/QR&O manifest shortlist
 * - isRecord: Type guard for plain object records
 * - parseChoiceAnswer: Parses a Clef choice answer from an unknown payload
 * - decideShouldReply: Asks Clef-flash whether CAF-GPT should reply; propagates AI.run failures
 * - decideShouldUpdateMemory: Asks Clef-flash whether MemoryFoo should run; propagates AI.run failures
 * - shortlistManifestFiles: Asks Clef-flash which indexed files to prefetch; propagates AI.run failures
 * - buildShortlistQuestions: Builds ranked Clef choice questions over allowlisted manifest rows
 */

import type { ManifestRow } from "./ManifestParser";

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

/**
 * Minimum `confidence` (0–1) required to accept a ranked shortlist pick.
 * Below this (or malformed/unknown choice when Clef answered) that pick is skipped.
 */
export const CLEF_SHORTLIST_CONFIDENCE_THRESHOLD = 0.6;

/** Default maximum number of indexed documents Clef may shortlist for prefetch. */
export const CLEF_SHORTLIST_MAX_PICKS = 3;

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

/** Outcome of the DOAD/QR&O manifest shortlist (allowlisted ids only). */
export interface ManifestShortlistDecision {
  ids: string[];
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

interface ClefChoiceQuestion {
  type: "choice";
  instructions: string;
  criteria: { [optionKey: string]: string };
}

interface ShortlistQuestionBuild {
  questions: { [pickKey: string]: ClefChoiceQuestion };
  keyToId: Map<string, string>;
  pickKeys: string[];
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

const NONE_OPTION = "none" as const;

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

/**
 * Builds ranked Clef choice questions that pick up to maxPicks allowlisted documents.
 * Option keys are stable `doc_N` tokens mapped back to manifest ids (paths stay out of option keys).
 * @param rows - Allowlisted manifest rows
 * @param maxPicks - Maximum documents to select
 */
function buildShortlistQuestions(rows: ManifestRow[], maxPicks: number): ShortlistQuestionBuild {
  const keyToId = new Map<string, string>();
  const criteriaPairs: Array<readonly [string, string]> = [
    [NONE_OPTION, "No additional indexed document should be loaded for this question"],
  ];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const key = `doc_${i}`;
    keyToId.set(key, row.id);
    const title = row.title.trim().length > 0 ? row.title.trim() : row.file;
    criteriaPairs.push([key, `${row.id} — ${title}`]);
  }
  const criteria = Object.fromEntries(criteriaPairs);

  const pickKeys: string[] = [];
  const questions: ShortlistQuestionBuild["questions"] = {};
  for (let rank = 1; rank <= maxPicks; rank++) {
    const key = `pick_${rank}`;
    pickKeys.push(key);
    questions[key] = {
      type: "choice",
      instructions:
        rank === 1
          ? "Which indexed document from the options is MOST relevant to load for the user question? Choose none if none apply."
          : `Which indexed document is the next most relevant to load (rank ${rank})? Do not repeat a document already chosen for a higher pick. Choose none if fewer documents are needed.`,
      criteria,
    };
  }

  return { questions, keyToId, pickKeys };
}

/**
 * Ask Clef-flash which allowlisted manifest ids to prefetch for a policy question.
 * Propagates AI.run failures (outages/timeouts).
 * Fail-closed reasons: malformed → clef_malformed_*; only rejected picks → clef_empty_shortlist; confident none → clef_intentional_none.
 * Never invents paths outside the allowlist.
 * @param ai - Injectable Workers AI runner
 * @param question - User research question
 * @param rows - Allowlisted manifest rows (Id/Title/File)
 * @param options - Optional max picks and confidence threshold overrides
 */
export async function shortlistManifestFiles(
  ai: ClefAiRunner,
  question: string,
  rows: ManifestRow[],
  options: { maxPicks?: number; confidenceThreshold?: number } = {}
): Promise<ManifestShortlistDecision> {
  const maxPicks = Math.max(0, options.maxPicks ?? CLEF_SHORTLIST_MAX_PICKS);
  const confidenceThreshold = options.confidenceThreshold ?? CLEF_SHORTLIST_CONFIDENCE_THRESHOLD;

  if (rows.length === 0 || maxPicks === 0) {
    return { ids: [], reason: "clef_empty_manifest" };
  }

  const { questions, keyToId, pickKeys } = buildShortlistQuestions(rows, maxPicks);
  const state = `<user_question>
${question}
</user_question>

<manifest>
| Id | Title | File |
|---|---|---|
${rows.map((row) => `| ${row.id} | ${row.title} | ${row.file} |`).join("\n")}
</manifest>`;

  const raw = await ai.run(CLEF_FLASH_MODEL, {
    model: "clef-flash",
    state,
    questions,
  });

  if (!isRecord(raw)) {
    return { ids: [], reason: "clef_malformed_response" };
  }

  const answers = raw.answers;
  if (!isRecord(answers)) {
    return { ids: [], reason: "clef_malformed_answer" };
  }

  const selected: string[] = [];
  const seen = new Set<string>();
  let sawValidAnswer = false;
  let sawMalformedRank = false;
  let sawInvalidChoice = false;
  let stoppedOnHighConfidenceNone = false;

  for (const pickKey of pickKeys) {
    const answer = parseChoiceAnswer(answers[pickKey]);
    if (!answer) {
      sawMalformedRank = true;
      continue;
    }
    sawValidAnswer = true;

    if (answer.confidence < confidenceThreshold) {
      // Low-confidence none or doc — skip this rank; do not stop the shortlist early.
      continue;
    }

    if (answer.choice === NONE_OPTION) {
      stoppedOnHighConfidenceNone = true;
      break;
    }

    const id = keyToId.get(answer.choice);
    if (id === undefined) {
      // Unknown / invented option key — fail the whole shortlist after the loop.
      sawInvalidChoice = true;
      continue;
    }
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    selected.push(id);
  }

  if (!sawValidAnswer || sawMalformedRank) {
    return { ids: [], reason: "clef_malformed_answer" };
  }

  if (sawInvalidChoice) {
    return { ids: [], reason: "clef_invalid_choice" };
  }

  if (selected.length === 0) {
    // Intentional empty only when Clef confidently chose none with no invalid ranks.
    if (stoppedOnHighConfidenceNone) {
      return { ids: [], reason: "clef_intentional_none" };
    }
    return { ids: [], reason: "clef_empty_shortlist" };
  }

  return { ids: selected, reason: "clef_shortlist" };
}
