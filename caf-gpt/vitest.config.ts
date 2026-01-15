/**
 * vitest.config.ts
 *
 * Vitest configuration for testing Cloudflare Workers application
 *
 * Top-level declarations:
 * - defineConfig: Import from vitest/config
 * - default export: Enhanced Vitest config with coverage and test organization
 */

import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Use node environment for Cloudflare Workers testing
    environment: "node",

    // Enable global test APIs (describe, it, expect, etc.)
    globals: true,

    // Test file patterns
    include: ["tests/**/*.test.ts", "tests/**/*.spec.ts"],

    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/**",
        "tests/**",
        "dist/**",
        ".wrangler/**",
        "**/*.d.ts",
        "**/*.config.ts",
        "**/types.ts",
      ],
      // Aim for good coverage thresholds
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },

    // Setup files to run before tests
    setupFiles: ["./tests/setup.ts"],

    // Test timeout
    testTimeout: 10000,

    // Mock configuration
    clearMocks: true,
    restoreMocks: true,
  },

  // Path resolution for imports
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@tests": path.resolve(__dirname, "./tests"),
    },
  },
});
