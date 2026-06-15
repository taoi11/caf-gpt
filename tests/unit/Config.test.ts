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
  it("uses forces.gc.ca and luffy email as default authorization", () => {
    const config = createConfig(undefined);

    expect(config.authorization.authorizedDomains).toEqual(["forces.gc.ca"]);
    expect(config.authorization.authorizedEmails).toEqual(["luffy@luffy.email"]);
  });

  it("parses AUTHORIZED_SENDERS into domain and explicit email allowlists", () => {
    const config = createConfig({
      AUTHORIZED_SENDERS: "forces.gc.ca,admin@test.com",
    } as Env);

    expect(config.authorization.authorizedDomains).toEqual(["forces.gc.ca"]);
    expect(config.authorization.authorizedEmails).toEqual(["admin@test.com"]);
  });
});
