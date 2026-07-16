/**
 * src/schemas.ts
 *
 * Zod schemas for LangChain structured output validation
 *
 * Top-level declarations:
 * - MemoryResponseSchema: Schema for memory update agent responses
 * - MemoryUpdateToolInputSchema: Schema for memory update tool input
 * - MemoryUnchangedToolInputSchema: Schema for unchanged memory tool input
 */

import { z } from "zod";

export const MemoryResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("unchanged"),
  }),
  z.object({
    status: z.literal("updated"),
    content: z.string().min(1).describe("The full updated memory narrative"),
  }),
]);

export const MemoryUpdateToolInputSchema = z.object({
  content: z.string().min(1).describe("The full updated memory narrative"),
});

export const MemoryUnchangedToolInputSchema = z.object({});
