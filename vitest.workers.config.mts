/**
 * vitest.workers.config.mts
 *
 * Vitest configuration for Cloudflare Workers runtime integration tests
 *
 * Top-level declarations:
 * - default export: Workers-pool Vitest config for Durable Object Agent tests
 */

import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      remoteBindings: false,
      wrangler: {
        configPath: "./wrangler.jsonc",
      },
      // Test-only placeholder secrets; Resend is reached only through mocked fetch.
      miniflare: {
        bindings: {
          RESEND_API_KEY: "re_test_placeholder",
          RESEND_WEBHOOK_SECRET: "whsec_dGVzdC13ZWJob29rLXNpZ25pbmctc2VjcmV0",
        },
      },
    }),
  ],
  test: {
    globals: true,
    include: ["tests/workers/**/*.test.ts"],
    setupFiles: ["./tests/workers/setup.ts"],
    testTimeout: 10000,
    clearMocks: true,
    restoreMocks: true,
  },
});
