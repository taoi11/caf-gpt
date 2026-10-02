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
 * - runBinaryChoiceGate: Shared fail-closed Clef choice validation/confidence/result construction
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
 * Below this, allowlisted/none picks are skipped; invented/malformed picks still fail the shortlist.
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

interface ClefChoiceQuestion {
  type: "choice";
  instructions: string;
  criteria: { [optionKey: string]: string };
}

interface BinaryChoiceGateOptions {
  questionKey: string;
  question: ClefChoiceQuestion;
  affirmative: string;
  negative: string;
  threshold: number;
  reasons: {
    affirmative: string;
    negative: string;
  };
}

interface BinaryChoiceGateResult {
  shouldProceed: boolean;
  choice?: string;
  confidence?: number;
  reason: string;
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
 * Runs a fail-closed Clef binary choice gate: malformed/unknown/low-confidence → shouldProceed false.
 * Propagates AI.run failures to the caller.
 * @param ai - Injectable Workers AI runner
 * @param state - Clef state string (email context, memory, reply text as applicable)
 * @param options - Question key/criteria, affirmative/negative labels, threshold, and reason strings
 */
async function runBinaryChoiceGate(
  ai: ClefAiRunner,
  state: string,
  options: BinaryChoiceGateOptions
): Promise<BinaryChoiceGateResult> {
  const raw = await ai.run(CLEF_FLASH_MODEL, {
    model: "clef-flash",
    state,
    questions: {
      [options.questionKey]: options.question,
    },
  });

  if (!isRecord(raw)) {
    return { shouldProceed: false, reason: "clef_malformed_response" };
  }

  const answers = raw.answers;
  if (!isRecord(answers)) {
    return { shouldProceed: false, reason: "clef_malformed_answer" };
  }

  const answer = parseChoiceAnswer(answers[options.questionKey]);
  if (!answer) {
    return { shouldProceed: false, reason: "clef_malformed_answer" };
  }

  if (answer.choice !== options.affirmative && answer.choice !== options.negative) {
    return {
      shouldProceed: false,
      confidence: answer.confidence,
      reason: "clef_unknown_choice",
    };
  }

  if (answer.choice !== options.affirmative) {
    return {
      shouldProceed: false,
      choice: options.negative,
      confidence: answer.confidence,
      reason: options.reasons.negative,
    };
  }

  if (answer.confidence < options.threshold) {
    return {
      shouldProceed: false,
      choice: options.affirmative,
      confidence: answer.confidence,
      reason: "clef_low_confidence",
    };
  }

  return {
    shouldProceed: true,
    choice: options.affirmative,
    confidence: answer.confidence,
    reason: options.reasons.affirmative,
  };
}

/**
 * Ask Clef-flash whether an inbound email warrants a reply; fail-closed; propagates AI.run failures.
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

  const gate = await runBinaryChoiceGate(ai, state, {
    questionKey: "should_reply",
    question: SHOULD_REPLY_QUESTION,
    affirmative: "reply",
    negative: "no_reply",
    threshold: CLEF_REPLY_CONFIDENCE_THRESHOLD,
    reasons: { affirmative: "clef_reply", negative: "clef_no_reply" },
  });

  const result: ReplyGateDecision = { shouldReply: gate.shouldProceed, reason: gate.reason };
  if (gate.choice === "reply" || gate.choice === "no_reply") result.choice = gate.choice;
  if (gate.confidence !== undefined) result.confidence = gate.confidence;
  return result;
}

/**
 * Ask Clef-flash whether a reply exchange warrants MemoryFoo; fail-closed; propagates AI.run failures.
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

  const gate = await runBinaryChoiceGate(ai, state, {
    questionKey: "should_update_memory",
    question: SHOULD_UPDATE_MEMORY_QUESTION,
    affirmative: "update",
    negative: "no_update",
    threshold: CLEF_MEMORY_UPDATE_CONFIDENCE_THRESHOLD,
    reasons: { affirmative: "clef_update", negative: "clef_no_update" },
  });

  const result: MemoryUpdateGateDecision = {
    shouldUpdate: gate.shouldProceed,
    reason: gate.reason,
  };
  if (gate.choice === "update" || gate.choice === "no_update") result.choice = gate.choice;
  if (gate.confidence !== undefined) result.confidence = gate.confidence;
  return result;
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
 * Fail-closed reasons: malformed → clef_malformed_*; invented → clef_invalid_choice; duplicate → clef_duplicate_choice;
 * conflicting picks after confident none → clef_conflicting_choice; only rejected picks → clef_empty_shortlist; confident none → clef_intentional_none.
 * Never invents paths outside the allowlist. Validate every ranked answer (including after none / low confidence).
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
  let failureReason:
    | "clef_malformed_answer"
    | "clef_invalid_choice"
    | "clef_duplicate_choice"
    | "clef_conflicting_choice"
    | null = null;
  let stoppedOnHighConfidenceNone = false;

  for (const pickKey of pickKeys) {
    if (failureReason !== null) {
      break;
    }

    const answer = parseChoiceAnswer(answers[pickKey]);
    if (!answer) {
      failureReason = "clef_malformed_answer";
      break;
    }
    sawValidAnswer = true;

    const isNone = answer.choice === NONE_OPTION;
    const id = isNone ? undefined : keyToId.get(answer.choice);

    // Allowlist every rank before confidence skips so invented options cannot partially succeed.
    if (!isNone && id === undefined) {
      failureReason = "clef_invalid_choice";
      break;
    }

    // All ranks are answered independently — keep validating after a confident none.
    if (stoppedOnHighConfidenceNone) {
      if (!isNone) {
        failureReason = "clef_conflicting_choice";
        break;
      }
      continue;
    }

    if (answer.confidence < confidenceThreshold) {
      // Low-confidence none or allowlisted doc — skip this rank; do not stop early.
      continue;
    }

    if (isNone) {
      stoppedOnHighConfidenceNone = true;
      continue;
    }

    // High-confidence allowlisted document (id validated above when !isNone).
    if (id === undefined) {
      failureReason = "clef_invalid_choice";
      break;
    }
    if (seen.has(id)) {
      failureReason = "clef_duplicate_choice";
      break;
    }
    seen.add(id);
    selected.push(id);
  }

  if (failureReason !== null) {
    return { ids: [], reason: failureReason };
  }

  if (!sawValidAnswer) {
    return { ids: [], reason: "clef_malformed_answer" };
  }

  if (selected.length === 0) {
    // Intentional empty only when Clef confidently chose none with no validation failures.
    if (stoppedOnHighConfidenceNone) {
      return { ids: [], reason: "clef_intentional_none" };
    }
    return { ids: [], reason: "clef_empty_shortlist" };
  }

  return { ids: selected, reason: "clef_shortlist" };
}
