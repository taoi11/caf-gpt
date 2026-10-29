/**
 * tests/unit/ToolReadingAgent.test.ts
 *
 * Unit tests for the read_file tool loop under the real AI SDK generateText (scripted mock model)
 *
 * Top-level declarations:
 * - readStep / answerStep: Scripted model steps (one read_file call, or a final text answer)
 * - scriptedModel: Mock model that replays the given steps in order
 * - loggedText / expectLogged: Logger capture for content-leak and count-field checks
 */

import { generateText } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockEnv } from "../mocks";
import { MockFetcher, MockR2Bucket } from "../mocks/cloudflare";

import { DoadFooAgent } from "../../src/agents/sub-agents/DoadFooAgent";
import { createConfig } from "../../src/config";
import {
  AgentValidationError,
  StorageNotFoundError,
  StorageValidationError,
} from "../../src/errors";
import type { ToolReadDiagnostics } from "../../src/email/utils/LogRedaction";
import { Logger } from "../../src/Logger";
import { DocumentRetriever } from "../../src/storage/DocumentRetriever";

const QUESTION = "Secret member question about release";
const TITLE = "Conduct and Performance Deficiencies";
const BODY = "Body text of DAOD 5019-0";

/** The read_file tool as ToolReadingAgent hands it to generateText. */
interface ReadFileToolOptions {
  tools: { read_file: { execute: (input: { file: string }) => Promise<{ ok: boolean }> } };
}

/** Count fields (plus error name) a read log line is expected to carry. */
type ExpectedLogFields = Partial<ToolReadDiagnostics> & { errorName?: string };

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

type ScriptedStep = Awaited<ReturnType<MockLanguageModelV3["doGenerate"]>>;

/** One model step that calls read_file with the given file value. */
function readStep(file: string): ScriptedStep {
  return {
    content: [
      {
        type: "tool-call",
        toolCallId: `call-${crypto.randomUUID()}`,
        toolName: "read_file",
        input: JSON.stringify({ file }),
      },
    ],
    finishReason: { unified: "tool-calls", raw: undefined },
    usage,
    warnings: [],
  };
}

/** One model step that answers with text. */
function answerStep(text: string): ScriptedStep {
  return {
    content: [{ type: "text", text }],
    finishReason: { unified: "stop", raw: undefined },
    usage,
    warnings: [],
  };
}

/** Mock model that replays the given steps in order (the last one repeats). */
function scriptedModel(steps: ScriptedStep[]): MockLanguageModelV3 {
  let call = 0;

  return new MockLanguageModelV3({
    doGenerate: async () => {
      const step = steps[Math.min(call, steps.length - 1)];
      call += 1;

      return step;
    },
  });
}

describe("ToolReadingAgent read_file loop (real generateText)", () => {
  let mockEnv: ReturnType<typeof createMockEnv>;
  let mockBucket: MockR2Bucket;
  let logSpies: Array<ReturnType<typeof vi.spyOn>>;

  /** Everything the Logger received during the test, serialized. */
  function loggedText(): string {
    return JSON.stringify(logSpies.flatMap((spy) => spy.mock.calls));
  }

  /** Asserts the first log line with this message carries these count fields. */
  function expectLogged(message: string, fields: ExpectedLogFields): void {
    const found = logSpies.flatMap((spy) => spy.mock.calls).find((call) => call[0] === message);

    expect(found?.at(-1)).toMatchObject(fields);
  }

  /** DoadFooAgent wired to the scripted model and the real AI SDK generateText. */
  function agentFor(model: MockLanguageModelV3): DoadFooAgent {
    return new DoadFooAgent(mockEnv, createConfig(mockEnv), {
      createModel: () => model,
      generateText,
    });
  }

  beforeEach(() => {
    DocumentRetriever.clearCache();
    mockBucket = new MockR2Bucket();
    const mockAssets = new MockFetcher();
    mockEnv = Object.assign(createMockEnv(), { R2_BUCKET: mockBucket, ASSETS: mockAssets });

    mockBucket.seed(
      "doad/index_v2.md",
      `| Id | Title | File |
|---|---|---|
| 5019-0 | ${TITLE} | 5019-0.md |
| 5031-1 | Grievances | 5031-1.md |
| 9999-9 | Missing file | 9999-9.md |
| ../bad | Unsafe | ../bad.md |`
    );
    mockBucket.seed("doad/5019-0.md", BODY);
    mockBucket.seed("doad/5031-1.md", "Body text of DAOD 5031-1");
    mockAssets.setPrompt("doad_foo_tool_reader", "Table: {doad_table}\nQuery: {user_input}");

    const logger = Logger.getInstance();
    logSpies = (["info", "warn", "error", "debug", "performance"] as const).map((level) =>
      vi.spyOn(logger, level)
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a bad Id to the model as an error, then answers from a corrected read", async () => {
    const model = scriptedModel([readStep("5019"), readStep("5019-0"), answerStep("Answer")]);

    await expect(agentFor(model).research({ question: QUESTION })).resolves.toBe("Answer");

    expect(model.doGenerateCalls).toHaveLength(3);
    const secondPrompt = JSON.stringify(model.doGenerateCalls[1].prompt);
    expect(secondPrompt).toContain("is not in the provided index");
    const thirdPrompt = JSON.stringify(model.doGenerateCalls[2].prompt);
    expect(thirdPrompt).toContain(BODY);

    expectLogged("doad_foo tool-reading research", {
      readReason: "read_ok",
      totalCalls: 2,
      successfulReads: 1,
      badCalls: 1,
      steps: 3,
      indexRows: 3,
      skippedRows: 1,
    });
  });

  it("puts the full index table in the prompt", async () => {
    const model = scriptedModel([readStep("5019-0"), answerStep("Answer")]);

    await agentFor(model).research({ question: QUESTION });

    const firstPrompt = JSON.stringify(model.doGenerateCalls[0].prompt);
    expect(firstPrompt).toContain(TITLE);
    expect(firstPrompt).toContain("5031-1");
    expect(firstPrompt).toContain(QUESTION);
  });

  it("fails loudly on the third bad Id and stops the loop at that step", async () => {
    const model = scriptedModel([readStep("1"), readStep("2"), readStep("3"), answerStep("x")]);

    await expect(agentFor(model).research({ question: QUESTION })).rejects.toThrow(
      "correction budget exhausted"
    );

    expect(model.doGenerateCalls).toHaveLength(3);
    expectLogged("doad_foo tool-reading research failed", {
      readReason: "bad_call_budget_exhausted",
      badCalls: 2,
      successfulReads: 0,
      errorName: "AgentValidationError",
    });
  });

  it("passes a storage error through with its own type instead of a generic validation error", async () => {
    const model = scriptedModel([readStep("9999-9"), answerStep("x")]);

    const failure = agentFor(model).research({ question: QUESTION });
    await expect(failure).rejects.toBeInstanceOf(StorageNotFoundError);

    expect(model.doGenerateCalls).toHaveLength(1);
    expectLogged("doad_foo tool-reading research failed", {
      readReason: "tool_failed",
      errorName: "StorageNotFoundError",
    });
  });

  it("fails loudly with call_limit_exceeded when the model keeps reading past five attempts", async () => {
    const model = scriptedModel([
      readStep("5019-0"),
      readStep("5031-1"),
      readStep("5019-0"),
      readStep("5031-1"),
      readStep("5019-0"),
      readStep("5031-1"),
    ]);

    await expect(agentFor(model).research({ question: QUESTION })).rejects.toThrow(
      "total call limit exceeded"
    );

    expect(model.doGenerateCalls).toHaveLength(6);
    expectLogged("doad_foo tool-reading research failed", {
      readReason: "call_limit_exceeded",
      totalCalls: 5,
      successfulReads: 3,
      badCalls: 2,
    });
  });

  it("fails loudly with no_successful_reads when the model answers without reading", async () => {
    const model = scriptedModel([answerStep("Unsupported answer")]);

    const failure = agentFor(model).research({ question: QUESTION });
    await expect(failure).rejects.toBeInstanceOf(AgentValidationError);
    await expect(failure).rejects.toThrow("did not successfully read any documents");

    expectLogged("doad_foo tool-reading research failed", {
      readReason: "no_successful_reads",
      totalCalls: 0,
      steps: 1,
    });
  });

  it("fails loudly with a typed error when the index has no usable rows", async () => {
    mockBucket.seed(
      "doad/index_v2.md",
      "| Id | Title | File |\n|---|---|---|\n| ../x | Bad | ../x.md |"
    );
    const model = scriptedModel([answerStep("x")]);

    await expect(agentFor(model).research({ question: QUESTION })).rejects.toBeInstanceOf(
      StorageValidationError
    );

    expect(model.doGenerateCalls).toHaveLength(0);
    expectLogged("doad_foo tool-reading research failed", {
      readReason: "index_no_rows",
      indexRows: 0,
      skippedRows: 1,
    });
  });

  it("rejects an empty question with a typed error before calling the model", async () => {
    const model = scriptedModel([answerStep("x")]);

    await expect(agentFor(model).research({ question: "  " })).rejects.toBeInstanceOf(
      AgentValidationError
    );

    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it("never logs the question, Ids, titles, document bodies, or model output", async () => {
    const model = scriptedModel([
      readStep("not-a-real-id"),
      readStep("5019-0"),
      answerStep("Model answer text"),
    ]);

    await agentFor(model).research({ question: QUESTION });
    await expect(
      agentFor(scriptedModel([readStep("a"), readStep("b"), readStep("c")])).research({
        question: QUESTION,
      })
    ).rejects.toThrow();

    const logged = loggedText();

    for (const content of [QUESTION, "5019-0", "not-a-real-id", TITLE, BODY, "Model answer text"]) {
      expect(logged).not.toContain(content);
    }
  });
});

describe("ToolReadingAgent step limit (scripted generateText result)", () => {
  it("reports step_limit_reached when generation ends on a tool call without an answer", async () => {
    DocumentRetriever.clearCache();
    const mockBucket = new MockR2Bucket();
    const mockAssets = new MockFetcher();
    const mockEnv = Object.assign(createMockEnv(), { R2_BUCKET: mockBucket, ASSETS: mockAssets });
    mockBucket.seed(
      "doad/index_v2.md",
      "| Id | Title | File |\n|---|---|---|\n| 5019-0 | T | 5019-0.md |"
    );
    mockBucket.seed("doad/5019-0.md", "Body");
    mockAssets.setPrompt("doad_foo_tool_reader", "Table: {doad_table}\nQuery: {user_input}");
    const loggerError = vi.spyOn(Logger.getInstance(), "error");

    const toolCallStep = { content: [{ type: "tool-call" }, { type: "tool-result" }] };
    const scriptedGenerate = vi.fn();
    scriptedGenerate.mockImplementationOnce(async (options: ReadFileToolOptions) => {
      await options.tools.read_file.execute({ file: "5019-0" });

      return { text: "", steps: Array.from({ length: 6 }, () => toolCallStep) };
    });

    const agent = new DoadFooAgent(mockEnv, createConfig(mockEnv), {
      createModel: () => new MockLanguageModelV3(),
      generateText: scriptedGenerate,
    });

    await expect(agent.research({ question: "q" })).rejects.toThrow("step limit reached");

    const failure = loggerError.mock.calls.find(
      ([message]) => message === "doad_foo tool-reading research failed"
    );

    expect(failure?.[1]).toMatchObject({ readReason: "step_limit_reached", steps: 6 });
    vi.restoreAllMocks();
  });
});
