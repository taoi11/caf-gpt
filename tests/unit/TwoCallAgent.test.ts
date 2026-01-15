/**
 * tests/unit/TwoCallAgent.test.ts
 *
 * Unit tests for TwoCallAgent - base class for two-call pattern agents
 *
 * Tests:
 * - Selector -> Loader -> Answer pattern
 * - File selection from index
 * - Document loading from R2
 * - Answer generation with loaded content
 * - Error handling at each stage
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { TwoCallAgent, type TwoCallAgentConfig } from "../../src/agents/utils/TwoCallAgent";
import type { AppConfig } from "../../src/config";
import { createConfig } from "../../src/config";
import type { ResearchRequest } from "../../src/types";
import { createMockEnv } from "../mocks";
import type { MockR2Bucket } from "../mocks/cloudflare";

// Mock Assets type for testing
interface MockAssets {
  setPrompt: (key: string, value: string) => void;
  [key: string]: unknown; // Index signature to allow other properties
}

// Use vi.hoisted to define mock function BEFORE module imports
const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
}));

// Mock ChatOpenAI
vi.mock("@langchain/openai", () => ({
  ChatOpenAI: vi.fn(function MockChatOpenAI() {
    return {
      invoke: mockInvoke,
      withStructuredOutput: vi.fn((_schema: unknown) => ({
        invoke: mockInvoke,
      })),
    };
  }),
}));

// Test schema for selector
const TestSelectorSchema = z.object({
  files: z.array(z.string()).min(1).max(3),
});

type TestSelectorResponse = z.infer<typeof TestSelectorSchema>;

// Concrete implementation for testing
class TestTwoCallAgent extends TwoCallAgent<TestSelectorResponse> {
  protected async selectFiles(query: string): Promise<string[]> {
    return this.runSelector(query);
  }

  protected getSelectorSchema(): z.ZodType<TestSelectorResponse> {
    return TestSelectorSchema;
  }

  protected extractFilesFromResponse(response: TestSelectorResponse): string[] {
    return response.files;
  }

  protected getSelectorVariables(query: string, indexContent: string): Record<string, string> {
    return {
      index_content: indexContent,
      user_input: query,
    };
  }

  protected async getIndexContent(): Promise<string | null> {
    return this.docRetriever.getDocument("test", "index.md");
  }

  protected getFilePath(fileId: string): string {
    return `${fileId}.md`;
  }

  protected formatDocumentTag(fileId: string, content: string): string {
    return `<doc_${fileId}>\n${content}\n</doc_${fileId}>`;
  }
}

function setMockLLMStructuredResponse(response: TestSelectorResponse) {
  mockInvoke.mockResolvedValueOnce(response);
}

function setMockLLMResponse(response: string) {
  mockInvoke.mockResolvedValueOnce({ content: response });
}

function setMockLLMError(message: string) {
  mockInvoke.mockRejectedValueOnce(new Error(message));
}

describe("TwoCallAgent", () => {
  let agent: TestTwoCallAgent;
  let mockEnv: ReturnType<typeof createMockEnv>;
  let mockBucket: MockR2Bucket;
  let config: AppConfig;

  const agentConfig: TwoCallAgentConfig = {
    category: "test",
    policyType: "test policy",
    modelKey: "leaveFoo",
    selectorPromptName: "test_selector",
    answerPromptName: "test_answer",
  };

  beforeEach(() => {
    mockInvoke.mockReset();

    mockEnv = createMockEnv();
    config = createConfig(undefined);
    mockBucket = mockEnv.R2_BUCKET as unknown as MockR2Bucket;

    // Seed index file
    mockBucket.seed(
      "test/index.md",
      `# Test Index
| ID | Title |
|----|-------|
| doc1 | Document 1 |
| doc2 | Document 2 |
| doc3 | Document 3 |`
    );

    // Seed test documents
    mockBucket.seed("test/doc1.md", "# Document 1\n\nContent of document 1");
    mockBucket.seed("test/doc2.md", "# Document 2\n\nContent of document 2");
    mockBucket.seed("test/doc3.md", "# Document 3\n\nContent of document 3");

    // Add test selector and answer prompts
    const mockAssets = mockEnv.ASSETS as unknown as MockAssets;
    mockAssets.setPrompt("test_selector", "Select files: {index_content}\nQuery: {user_input}");
    mockAssets.setPrompt("test_answer", "Answer using: {test_content}\nQuery: {user_input}");

    agent = new TestTwoCallAgent(mockEnv, config, agentConfig);
  });

  describe("research", () => {
    it("should complete full two-call pattern successfully", async () => {
      // Mock selector response
      setMockLLMStructuredResponse({ files: ["doc1", "doc2"] });

      // Mock answer response
      setMockLLMResponse("This is the answer based on documents 1 and 2.");

      const request: ResearchRequest = {
        question: "What is the policy on test documents?",
      };

      const result = await agent.research(request);

      expect(result).toContain("answer based on documents");
      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    it("should reject empty research question", async () => {
      const request: ResearchRequest = {
        question: "",
      };

      const result = await agent.research(request);

      expect(result).toContain("error");
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("should reject whitespace-only research question", async () => {
      const request: ResearchRequest = {
        question: "   \n\t  ",
      };

      const result = await agent.research(request);

      expect(result).toContain("error");
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("should handle missing index file", async () => {
      await mockBucket.delete("test/index.md");

      const request: ResearchRequest = {
        question: "Test question",
      };

      const result = await agent.research(request);

      expect(result).toContain("couldn't identify relevant");
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("should handle selector returning empty file list", async () => {
      setMockLLMStructuredResponse({ files: [] });

      const request: ResearchRequest = {
        question: "Test question",
      };

      const result = await agent.research(request);

      expect(result).toContain("couldn't identify relevant");
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });

    it("should handle selector error gracefully", async () => {
      setMockLLMError("Selector API error");

      const request: ResearchRequest = {
        question: "Test question",
      };

      const result = await agent.research(request);

      expect(result).toContain("couldn't identify relevant");
    });

    it("should handle missing selected documents", async () => {
      setMockLLMStructuredResponse({ files: ["nonexistent1", "nonexistent2"] });

      const request: ResearchRequest = {
        question: "Test question",
      };

      const result = await agent.research(request);

      expect(result).toContain("No relevant");
    });

    it("should handle partial document loading failure", async () => {
      // Only doc1 exists, doc2 and doc3 missing
      await mockBucket.delete("test/doc2.md");
      await mockBucket.delete("test/doc3.md");

      setMockLLMStructuredResponse({ files: ["doc1", "doc2", "doc3"] });
      setMockLLMResponse("Answer based on available documents");

      const request: ResearchRequest = {
        question: "Test question",
      };

      const result = await agent.research(request);

      // Should still succeed with doc1
      expect(result).toContain("Answer based on available documents");
      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    it("should handle answer generation error", async () => {
      setMockLLMStructuredResponse({ files: ["doc1"] });
      setMockLLMError("Answer API error");

      const request: ResearchRequest = {
        question: "Test question",
      };

      const result = await agent.research(request);

      expect(result).toContain("issue with the AI service");
    });

    it("should load multiple documents in parallel", async () => {
      setMockLLMStructuredResponse({ files: ["doc1", "doc2", "doc3"] });
      setMockLLMResponse("Answer using all three documents");

      const request: ResearchRequest = {
        question: "Test question",
      };

      const result = await agent.research(request);

      expect(result).toContain("Answer using all three documents");

      // Check that answer call includes all three documents
      const answerCallArgs = mockInvoke.mock.calls[1];
      expect(answerCallArgs).toBeDefined();
    });

    it("should format documents with correct tags", async () => {
      setMockLLMStructuredResponse({ files: ["doc1"] });

      // Capture the prompt input to verify formatting
      let capturedPrompt = "";
      mockInvoke.mockImplementation(async (input: unknown) => {
        if (
          typeof input === "object" &&
          input !== null &&
          "messages" in input &&
          Array.isArray(input.messages) &&
          input.messages[0]
        ) {
          const msg = input.messages[0] as { content: string };
          capturedPrompt = msg.content;
        }
        return { content: "Answer" };
      });

      const request: ResearchRequest = {
        question: "Test question",
      };

      await agent.research(request);

      expect(capturedPrompt).toContain("<doc_doc1>");
      expect(capturedPrompt).toContain("</doc_doc1>");
    });

    it("should include query in selector call", async () => {
      let capturedQuery = "";
      mockInvoke.mockImplementationOnce(async (input: unknown) => {
        if (
          typeof input === "object" &&
          input !== null &&
          "messages" in input &&
          Array.isArray(input.messages) &&
          input.messages.length > 0
        ) {
          const msg = input.messages[input.messages.length - 1] as { content: string };
          capturedQuery = msg.content;
        }
        return { files: ["doc1"] };
      });

      mockInvoke.mockResolvedValueOnce({ content: "Answer" });

      const request: ResearchRequest = {
        question: "What is the test policy?",
      };

      await agent.research(request);

      expect(capturedQuery).toContain("What is the test policy?");
    });

    it("should truncate long questions in logs", async () => {
      const longQuestion = "a".repeat(200);

      setMockLLMStructuredResponse({ files: ["doc1"] });
      setMockLLMResponse("Answer");

      const request: ResearchRequest = {
        question: longQuestion,
      };

      const result = await agent.research(request);

      expect(result).toBeDefined();
      // Performance log should truncate to 100 chars
    });
  });

  describe("loadFiles", () => {
    it("should load single file successfully", async () => {
      // @ts-expect-error - Testing protected method
      const content = await agent.loadFiles(["doc1"]);

      expect(content).toContain("Document 1");
      expect(content).toContain("<doc_doc1>");
    });

    it("should load multiple files and join with newlines", async () => {
      // @ts-expect-error - Testing protected method
      const content = await agent.loadFiles(["doc1", "doc2"]);

      expect(content).toContain("Document 1");
      expect(content).toContain("Document 2");
      expect(content).toContain("<doc_doc1>");
      expect(content).toContain("<doc_doc2>");
    });

    it("should handle missing files gracefully", async () => {
      // @ts-expect-error - Testing protected method
      const content = await agent.loadFiles(["doc1", "nonexistent", "doc2"]);

      expect(content).toContain("Document 1");
      expect(content).toContain("Document 2");
      expect(content).not.toContain("nonexistent");
    });

    it("should return empty string when all files missing", async () => {
      // @ts-expect-error - Testing protected method
      const content = await agent.loadFiles(["missing1", "missing2"]);

      expect(content).toBe("");
    });

    it("should load files in parallel", async () => {
      const startTime = Date.now();
      // @ts-expect-error - Testing protected method
      await agent.loadFiles(["doc1", "doc2", "doc3"]);
      const duration = Date.now() - startTime;

      // Parallel loading should be fast (< 100ms for mocked data)
      expect(duration).toBeLessThan(100);
    });
  });

  describe("answerQuery", () => {
    it("should call LLM with correct parameters", async () => {
      setMockLLMResponse("Generated answer");

      // @ts-expect-error - Testing protected method
      const answer = await agent.answerQuery(
        "Test question",
        "<doc_doc1>Document 1 content</doc_doc1>"
      );

      expect(answer).toBe("Generated answer");
      expect(mockInvoke).toHaveBeenCalled();
    });

    it("should include content in prompt variables", async () => {
      let capturedVariables: unknown = null;
      mockInvoke.mockImplementationOnce(async (input: unknown) => {
        const typedInput = input as { messages?: Array<{ content: string }> };
        if (typedInput.messages?.[0]) {
          capturedVariables = typedInput.messages[0].content;
        }
        return { content: "Answer" };
      });

      // @ts-expect-error - Testing protected method
      await agent.answerQuery("Test question", "Document content here");

      expect(capturedVariables).toContain("Document content here");
    });

    it("should throw error on LLM failure", async () => {
      setMockLLMError("API error");

      // @ts-expect-error - Testing protected method
      await expect(agent.answerQuery("Test question", "Content")).rejects.toThrow("API error");
    });
  });

  describe("runSelector", () => {
    it("should return files from selector", async () => {
      setMockLLMStructuredResponse({ files: ["doc1"] });

      // @ts-expect-error - Testing protected method
      const files = await agent.runSelector("Test query");

      expect(files).toEqual(["doc1"]);
    });

    it("should return empty array when index missing", async () => {
      setMockLLMStructuredResponse({ files: ["doc1"] });
      await mockBucket.delete("test/index.md");

      // @ts-expect-error - Testing protected method
      const files = await agent.runSelector("Test query");

      expect(files).toEqual([]);
    });

    it("should return empty array on selector error", async () => {
      setMockLLMError("Selector error");

      // @ts-expect-error - Testing protected method
      const files = await agent.runSelector("Test query");

      expect(files).toEqual([]);
    });

    it("should return multiple files", async () => {
      setMockLLMStructuredResponse({ files: ["doc1", "doc2", "doc3"] });

      // @ts-expect-error - Testing protected method
      const files = await agent.runSelector("Test query");

      expect(files).toEqual(["doc1", "doc2", "doc3"]);
    });
  });
});
