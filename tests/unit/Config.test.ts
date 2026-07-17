/**
 * tests/unit/Config.test.ts
 *
 * Unit tests for application configuration parsing.
 *
 * Top-level declarations:
 * - createConfig test suite: Verifies required authorization policy parsing
 */

import { describe, expect, it } from "vitest";
import { createConfig } from "../../src/config";

describe("createConfig", () => {
  it("parses AUTHORIZED_SENDERS into domain and explicit email allowlists", () => {
    const config = createConfig({
      AUTHORIZED_SENDERS: "forces.gc.ca,admin@test.com",
    } as Env);

    expect(config.authorization.authorizedDomains).toEqual(["forces.gc.ca"]);
    expect(config.authorization.authorizedEmails).toEqual(["admin@test.com"]);
  });

  it.each([undefined, "", "   "])("rejects missing or blank policy %j", (value) => {
    expect(() => createConfig({ AUTHORIZED_SENDERS: value } as unknown as Env)).toThrow(
      "AUTHORIZED_SENDERS is required"
    );
  });

  it.each([
    "forces.gc.ca,",
    "not a domain",
    "@forces.gc.ca",
    "member@",
    "forces..gc.ca",
  ])("rejects invalid policy entry %s", (value) => {
    expect(() => createConfig({ AUTHORIZED_SENDERS: value } as Env)).toThrow();
  });

  it("deduplicates and normalizes valid policy entries", () => {
    const config = createConfig({
      AUTHORIZED_SENDERS: "FORCES.GC.CA,forces.gc.ca,ADMIN@Test.com,admin@test.com",
    } as Env);

    expect(config.authorization.authorizedDomains).toEqual(["forces.gc.ca"]);
    expect(config.authorization.authorizedEmails).toEqual(["admin@test.com"]);
  });
});
