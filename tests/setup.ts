/**
 * tests/setup.ts
 *
 * Test setup file - runs before all tests
 *
 * - Mocks Cloudflare-specific modules
 * - Sets up global test configuration
 */

import { vi } from "vitest";

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
