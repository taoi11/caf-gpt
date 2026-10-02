/**
 * tests/workers/ClefMemoryUpdateGate.test.ts
 *
 * Workers tests for the Clef-flash memory update gate in UserAgent.runMemoryUpdate
 *
 * Top-level declarations:
 * - mockClefMemoryChoice: Mocks env.AI.run for should_update_memory choices
 * - getUserAgentStub: Gets a per-sender UserAgent Durable Object stub
 */

/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { reset, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MemoryFooAgent } from "../../src/agents/sub-agents";
import {
  CLEF_FLASH_MODEL,
  CLEF_MEMORY_UPDATE_CONFIDENCE_THRESHOLD,
} from "../../src/agents/utils/ClefDecision";
import { getUserAgentId, type UserAgent } from "../../src/agents/UserAgent";

afterEach(async () => {
  vi.restoreAllMocks();
  await reset();
});

describe("UserAgent Clef memory update gate", () => {
  it("skips MemoryFoo when Clef chooses no_update", async () => {
    const stub = getUserAgentStub("clef-memory-skip@forces.gc.ca");
    const updateMemory = vi.spyOn(MemoryFooAgent.prototype, "updateMemory");

    const state = await runInDurableObject(stub, async (instance: UserAgent) => {
      instance.setState({ memory: "Keep me", versions: [] });
      mockClefMemoryChoice("no_update", 0.91);
      await instance.runMemoryUpdate({
        emailContext: "Subject: Thanks\n\nThanks!",
        agentReply: "You're welcome.",
      });
      return instance.state;
    });

    expect(updateMemory).not.toHaveBeenCalled();
    expect(state.memory).toBe("Keep me");
  });

  it("runs MemoryFoo with edit prompt when Clef chooses update", async () => {
    const stub = getUserAgentStub("clef-memory-update@forces.gc.ca");
    const updateMemory = vi.spyOn(MemoryFooAgent.prototype, "updateMemory").mockResolvedValue({
      updated: true,
      content: "Updated via gated edit",
    });

    const state = await runInDurableObject(stub, async (instance: UserAgent) => {
      instance.setState({ memory: "Old memory", versions: [] });
      mockClefMemoryChoice("update", 0.94);
      await instance.runMemoryUpdate({
        emailContext: "Subject: Pref\n\nI prefer short answers.",
        agentReply: "Understood.",
      });
      return instance.state;
    });

    expect(updateMemory).toHaveBeenCalledWith(
      "Old memory",
      "Subject: Pref\n\nI prefer short answers.",
      "Understood.",
      { promptName: "memory_foo_edit" }
    );
    expect(state.memory).toBe("Updated via gated edit");
  });

  it("fails closed and skips MemoryFoo on low-confidence update", async () => {
    const stub = getUserAgentStub("clef-memory-low@forces.gc.ca");
    const updateMemory = vi.spyOn(MemoryFooAgent.prototype, "updateMemory");
    const low = Math.max(0, CLEF_MEMORY_UPDATE_CONFIDENCE_THRESHOLD - 0.05);

    const state = await runInDurableObject(stub, async (instance: UserAgent) => {
      instance.setState({ memory: "Unchanged", versions: [] });
      mockClefMemoryChoice("update", low);
      await instance.runMemoryUpdate({
        emailContext: "Subject: Maybe\n\nMaybe new?",
        agentReply: "Reply",
      });
      return instance.state;
    });

    expect(updateMemory).not.toHaveBeenCalled();
    expect(state.memory).toBe("Unchanged");
  });

  it("rethrows Clef AI.run outages so scheduled retries can run", async () => {
    const stub = getUserAgentStub("clef-memory-outage@forces.gc.ca");
    const updateMemory = vi.spyOn(MemoryFooAgent.prototype, "updateMemory");

    await runInDurableObject(stub, async (instance: UserAgent) => {
      const ai = env.AI as { run: (...args: unknown[]) => Promise<unknown> };
      vi.spyOn(ai, "run").mockImplementation(async (model: unknown) => {
        if (model === CLEF_FLASH_MODEL) {
          throw new Error("workers ai down");
        }
        throw new Error(`Unexpected AI.run model: ${String(model)}`);
      });

      await expect(
        instance.runMemoryUpdate({
          emailContext: "Subject: Test\n\nUser details",
          agentReply: "Agent reply",
        })
      ).rejects.toThrow("Scheduled memory update failed");
    });

    expect(updateMemory).not.toHaveBeenCalled();
  });
});

/** Mocks env.AI.run to return a Clef update/no_update choice for the memory gate. */
function mockClefMemoryChoice(choice: "update" | "no_update", confidence: number): void {
  const ai = env.AI as { run: (...args: unknown[]) => Promise<unknown> };
  vi.spyOn(ai, "run").mockImplementation(async (model: unknown) => {
    if (model === CLEF_FLASH_MODEL) {
      return {
        model: "clef-flash",
        answers: {
          should_update_memory: {
            type: "choice",
            choice,
            confidence,
            probabilities: {
              update: choice === "update" ? confidence : 1 - confidence,
              no_update: choice === "no_update" ? confidence : 1 - confidence,
            },
          },
        },
        usage: { input_tokens: 1, output_tokens: 1 },
      };
    }
    throw new Error(`Unexpected AI.run model: ${String(model)}`);
  });
}

/** Gets a per-sender UserAgent Durable Object stub. */
function getUserAgentStub(senderEmail: string) {
  return env.UserAgent.get(env.UserAgent.idFromName(getUserAgentId(senderEmail)));
}
