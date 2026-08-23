/**
 * src/schemas.ts
 *
 * Zod schemas for AI SDK memory tool input validation
 *
 * Top-level declarations:
 * - MemoryUpdateToolInputSchema: Schema for memory update tool input
 * - MemoryUnchangedToolInputSchema: Schema for unchanged memory tool input
 */

import { z } from "zod";

export const MemoryUpdateToolInputSchema = z.object({
  content: z.string().min(1).describe("The full updated memory narrative"),
});

export const MemoryUnchangedToolInputSchema = z.object({});
