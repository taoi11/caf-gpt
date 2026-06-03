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
      miniflare: {
        bindings: {
          AUTHORIZED_SENDERS: "forces.gc.ca,admin@test.com",
          CF_AIG_AUTH: "test-token",
          EMAIL_SECRET: "test-secret",
        },
      },
    }),
  ],
  test: {
    globals: true,
    include: ["tests/workers/**/*.test.ts"],
    testTimeout: 10000,
    clearMocks: true,
    restoreMocks: true,
  },
});
