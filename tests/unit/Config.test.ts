/**
 * tests/unit/Config.test.ts
 *
 * Unit tests for application configuration parsing.
 *
 * Top-level declarations:
 * - createConfig test suite: Verifies authorization configuration defaults and overrides
 */

import { describe, expect, it } from "vitest";
import { createConfig } from "../../src/config";

describe("createConfig", () => {
  it("includes the temporary authorized email in default authorization", () => {
    const config = createConfig(undefined);

    expect(config.authorization.authorizedEmails).toContain("taoi33@pm.me");
  });

  it("preserves the temporary authorized email when AUTHORIZED_SENDERS is configured", () => {
    const config = createConfig({
      AUTHORIZED_SENDERS: "forces.gc.ca,admin@test.com",
    } as Env);

    expect(config.authorization.authorizedDomains).toEqual(["forces.gc.ca"]);
    expect(config.authorization.authorizedEmails).toEqual(["admin@test.com", "taoi33@pm.me"]);
  });
});
