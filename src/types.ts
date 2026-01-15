/**
 * src/types.ts
 *
 * Core type definitions for agent responses and research requests
 *
 * Top-level declarations:
 * - AgentResponse: Agent response interface
 * - ResearchRequest: Research request interface
 */

export interface AgentResponse {
  content: string;
  shouldRespond: boolean;
}

export interface ResearchRequest {
  question: string;
}
