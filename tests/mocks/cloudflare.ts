/**
 * tests/mocks/cloudflare.ts
 *
 * Mock Cloudflare bindings for testing (R2, AI Gateway, Email, Assets, Hyperdrive)
 *
 * Top-level declarations:
 * - MockR2Object: Mock R2 object implementation
 * - MockR2Bucket: Mock R2 bucket implementation
 * - MockFetcher: Mock Fetcher for static assets
 * - MockHyperdrive: Mock Hyperdrive for database connections
 * - createMockEnv: Creates mock Cloudflare environment
 * - createMockFetch: Creates mock fetch function
 */

import { vi } from "vitest";

// Mock Hyperdrive for database connections
export class MockHyperdrive {
  connectionString = "postgres://mock:mock@localhost:5432/mock";
}

// Mock R2 object for get/put operations
export class MockR2Object {
  constructor(
    public key: string,
    public body: ReadableStream | string,
    public metadata: Record<string, string> = {}
  ) {}

  async text(): Promise<string> {
    if (typeof this.body === "string") {
      return this.body;
    }
    const reader = this.body.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const combined = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    return new TextDecoder().decode(combined);
  }
}

// Mock R2 bucket with in-memory storage
export class MockR2Bucket {
  private storage = new Map<string, MockR2Object>();

  async get(key: string): Promise<MockR2Object | null> {
    return this.storage.get(key) || null;
  }

  async put(
    key: string,
    value: string | ReadableStream,
    options?: { metadata?: Record<string, string> }
  ): Promise<void> {
    this.storage.set(key, new MockR2Object(key, value, options?.metadata));
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async list(options?: { prefix?: string }): Promise<{
    objects: Array<{ key: string }>;
  }> {
    const keys = Array.from(this.storage.keys());
    const filtered = options?.prefix
      ? keys.filter((k) => k.startsWith(options.prefix as string))
      : keys;
    return { objects: filtered.map((key) => ({ key })) };
  }

  // Helper for tests to seed data
  seed(key: string, content: string, metadata?: Record<string, string>): void {
    this.storage.set(key, new MockR2Object(key, content, metadata));
  }

  // Helper to clear all data
  clear(): void {
    this.storage.clear();
  }
}

// Mock Fetcher for static assets (prompts)
export class MockFetcher {
  private prompts = new Map<string, string>();

  constructor() {
    this.prompts.set(
      "pace_foo_research",
      `You are a feedback note generator for the Canadian Armed Forces.

Rank: {rank}

# Competencies
{competencies}

# Examples
{examples}

Generate a professional feedback note based on the context provided.`
    );

    this.prompts.set(
      "prime_foo",
      `You are CAF-GPT, an AI assistant for Canadian Armed Forces personnel.

Respond to queries about policies, leave, and generate feedback notes.

Use XML format:
- <reply>text</reply> for direct responses
- <research><sub_agent name="agent_name"><query>text</query></sub_agent></research> for research
- <feedback_note rank="cpl">context</feedback_note> for feedback notes
- <no_response /> when no response is needed`
    );

    this.prompts.set(
      "memory_foo",
      `# Memory Update Agent

You are a memory management agent for CAF-GPT.

## Current Memory

<current_memory>
{current_memory}
</current_memory>

## Response Format

If new information worth remembering:
<memory>Updated memory content</memory>

If nothing new:
<unchanged>true</unchanged>`
    );
  }

  async fetch(request: Request | string): Promise<Response> {
    const url = typeof request === "string" ? request : request.url;
    const match = url.match(/\/prompts\/([^.]+)\.md$/);

    if (match) {
      const promptName = match[1];
      const content = this.prompts.get(promptName);

      if (content) {
        return new Response(content, {
          status: 200,
          headers: { "Content-Type": "text/markdown" },
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  }

  // Helper to add custom prompts in tests
  setPrompt(name: string, content: string): void {
    this.prompts.set(name, content);
  }
}

// Create a complete mock environment
export function createMockEnv(overrides?: Partial<Env>): Env {
  const mockR2 = new MockR2Bucket();
  const mockAssets = new MockFetcher();
  const mockHyperdrive = new MockHyperdrive();

  const mockAIGateway = {
    gateway: vi.fn((_gatewayId: string) => ({
      getUrl: vi.fn(async (provider: string) => {
        return `https://gateway.ai.cloudflare.com/v1/test-account/test-gateway/${provider}/v1`;
      }),
      patchLog: vi.fn(),
      getLog: vi.fn(),
      run: vi.fn(),
    })),
  };

  return {
    AI_GATEWAY_ACCOUNT_ID: "test-account-id",
    AI_GATEWAY_ID: "test-gateway-id",
    SMTP_SERVER: "smtp.test.com",
    SMTP_PORT: "587",
    SMTP_USER: "test@test.com",
    SMTP_PASSWORD: "test-password",
    EMAIL_FROM: "cafgpt@test.com",
    OPENROUTER_API_KEY: "test-api-key",
    AUTHORIZED_SENDERS: "test@forces.gc.ca,admin@test.com",
    RESEND_API_KEY: "re_test_key_123456789",
    RESEND_WEBHOOK_SECRET: "whsec_test_secret_123456789",
    R2_BUCKET: mockR2 as unknown as R2Bucket,
    BUCKET: mockR2 as unknown as R2Bucket,
    ASSETS: mockAssets as unknown as Fetcher,
    AI_GATEWAY: mockAIGateway as unknown as Ai,
    HYPERDRIVE: mockHyperdrive as unknown as Hyperdrive,
    ...overrides,
  } as Env;
}

// Mock fetch for OpenRouter/AI Gateway calls
export function createMockFetch(responseBody: string, status = 200): typeof fetch {
  return vi.fn(async () => {
    return new Response(responseBody, { status });
  }) as unknown as typeof fetch;
}
