/**
 * vitest.workers.config.mts
 *
 * Vitest configuration for Cloudflare Workers runtime integration tests
 *
 * Top-level declarations:
 * - default export: Workers-pool Vitest config for Durable Object Agent tests
 */

import { randomBytes } from "node:crypto";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      remoteBindings: false,
      wrangler: {
        configPath: "./wrangler.jsonc",
      },
      // Test-only secrets; Resend is reached only through mocked fetch. The webhook signing secret
      // is generated per run (prefix + random base64) so no secret-looking literal is committed;
      // tests sign with env.RESEND_WEBHOOK_SECRET.
      miniflare: {
        bindings: {
          RESEND_API_KEY: "re_test_placeholder",
          RESEND_WEBHOOK_SECRET: `whsec${"_"}${randomBytes(24).toString("base64")}`,
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
