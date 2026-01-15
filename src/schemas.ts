/**
 * src/schemas.ts
 *
 * Zod schemas for LangChain structured output validation
 *
 * Top-level declarations:
 * - DoadSelectorSchema: Schema for DOAD file selector responses
 * - QroSelectorSchema: Schema for QRO file selector responses
 * - MemoryResponseSchema: Schema for memory update agent responses
 */

import { z } from "zod";

export const DoadSelectorSchema = z.object({
  doad_numbers: z
    .array(z.string())
    .min(1)
    .max(3)
    .describe("List of 1-3 relevant DOAD numbers (format: XXXX-X)"),
});

export const QroSelectorSchema = z.object({
  qro_files: z.array(z.string()).min(1).max(3).describe("List of 1-3 relevant QR&O file paths"),
});

export const MemoryResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("unchanged"),
  }),
  z.object({
    status: z.literal("updated"),
    content: z.string().min(1).describe("The full updated memory narrative"),
  }),
]);
