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
import { createMockEnv } from "../mocks";

describe("createConfig", () => {
  it("uses the code-reviewed authorization policy", () => {
    const config = createConfig();

    expect(config.llm.models.primeFoo).toMatchObject({
      model: "openai/gpt-5.6-terra",
      temperature: 0,
    });
    expect(config.llm.models.leaveFoo).toMatchObject({
      model: "openai/gpt-5.6-luna",
      temperature: 0,
    });
    expect(config.authorization.authorizedDomains).toEqual(["forces.gc.ca"]);
    expect(config.authorization.authorizedEmails).toEqual([
      "luffy@luffy.email",
      "munshi@dhaliwal.info",
    ]);
  });

  it("does not allow a legacy runtime value to broaden authorization", () => {
    const legacyEnv = Object.assign(createMockEnv(), {
      AUTHORIZED_SENDERS: "evil.com,attacker@example.com",
    });
    const config = createConfig(legacyEnv);

    expect(config.authorization.authorizedDomains).toEqual(["forces.gc.ca"]);
    expect(config.authorization.authorizedEmails).toEqual([
      "luffy@luffy.email",
      "munshi@dhaliwal.info",
    ]);
  });
});
