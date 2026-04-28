/**
 * tests/setup.ts
 *
 * Test setup file - runs before all tests
 *
 * - Mocks Cloudflare-specific modules
 * - Sets up global test configuration
 */

// Clear the DocumentRetriever cache before each test
import { beforeEach, vi } from "vitest";
import { DocumentRetriever } from "../src/storage/DocumentRetriever";

beforeEach(() => {
  DocumentRetriever.clearCache();
});

// Mock the cloudflare:email module (not available in test environment)
vi.mock("cloudflare:email", () => ({
  EmailMessage: class MockEmailMessage {
    from: string = "";
    to: string = "";
    headers: Map<string, string> = new Map();
    raw: string = "";
    rawSize: number = 0;

    async setReject(_reason: string) {}
    async forward(_to: string) {}
  },
}));
