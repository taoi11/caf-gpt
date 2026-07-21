/**
 * tests/unit/Config.test.ts
 *
 * Unit tests for static application authorization configuration.
 *
 * Top-level declarations:
 * - createConfig test suite: Verifies the code-reviewed authorization policy
 */

import { describe, expect, it } from "vitest";
import { createConfig } from "../../src/config";

describe("createConfig", () => {
  it("uses the code-reviewed authorization policy", () => {
    const config = createConfig();

    expect(config.authorization.authorizedDomains).toEqual(["forces.gc.ca"]);
    expect(config.authorization.authorizedEmails).toEqual([
      "luffy@luffy.email",
      "munshi@dhaliwal.info",
    ]);
  });

  it("does not allow a legacy runtime value to broaden authorization", () => {
    const legacyEnv = {
      AUTHORIZED_SENDERS: "evil.com,attacker@example.com",
    } as unknown as Env;
    const config = createConfig(legacyEnv);

    expect(config.authorization.authorizedDomains).toEqual(["forces.gc.ca"]);
    expect(config.authorization.authorizedEmails).toEqual([
      "luffy@luffy.email",
      "munshi@dhaliwal.info",
    ]);
  });
});
