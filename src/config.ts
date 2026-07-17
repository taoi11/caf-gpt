/**
 * src/config.ts
 *
 * Application configuration
 *
 * Top-level declarations:
 * - AppConfig: Overall application configuration interface
 * - parseAuthorizationPolicy: Parses and validates the required sender allowlist
 * - createConfig: Creates configuration from environment variables with overrides
 */

import { normalizeEmailAddress } from "./email/utils/EmailNormalizer";
import { isValidEmailAddress } from "./email/utils/EmailValidator";

interface LLMModelConfig {
  model: string;
  temperature: number;
  maxOutputTokens: number;
}

interface LLMConfig {
  models: {
    primeFoo: LLMModelConfig;
    leaveFoo: LLMModelConfig;
    paceFoo: LLMModelConfig;
    doadFoo: LLMModelConfig;
    qroFoo: LLMModelConfig;
    memoryFoo: LLMModelConfig;
  };
}

export interface AuthorizationConfig {
  authorizedDomains: string[];
  authorizedEmails: string[];
}

interface EmailConfig {
  agentFromEmail: string;
  monitoredAddresses: string[];
}

// Orchestrator model config - handles multi-turn conversations, coordination, tool use
const ORCHESTRATOR_CONFIG: LLMModelConfig = {
  model: "@cf/moonshotai/kimi-k2.7-code",
  temperature: 0.1,
  maxOutputTokens: 16384,
};

// Specialist model config - focused tasks: document Q&A, selection, generation
const SPECIALIST_CONFIG: LLMModelConfig = {
  model: "google-ai-studio/gemini-3.1-flash-lite-preview",
  temperature: 0.1,
  maxOutputTokens: 16384,
};

// Overall application configuration interface
export interface AppConfig {
  email: EmailConfig;
  authorization: AuthorizationConfig;
  llm: LLMConfig;
}

/** Parses the required comma-separated authorization policy without permissive defaults. */
function parseAuthorizationPolicy(value: string | undefined): AuthorizationConfig {
  if (!value?.trim()) {
    throw new Error("AUTHORIZED_SENDERS is required");
  }

  const entries = value.split(",").map((entry) => entry.trim().toLowerCase());
  if (entries.some((entry) => entry.length === 0)) {
    throw new Error("AUTHORIZED_SENDERS contains a blank entry");
  }

  const authorizedDomains: string[] = [];
  const authorizedEmails: string[] = [];
  const domainPattern =
    /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

  for (const entry of entries) {
    if (entry.includes("@")) {
      const normalized = normalizeEmailAddress(entry);
      if (!isValidEmailAddress(normalized) || normalized !== entry) {
        throw new Error("AUTHORIZED_SENDERS contains an invalid mailbox");
      }
      authorizedEmails.push(normalized);
      continue;
    }

    if (!domainPattern.test(entry)) {
      throw new Error("AUTHORIZED_SENDERS contains an invalid domain");
    }
    authorizedDomains.push(entry);
  }

  if (authorizedDomains.length + authorizedEmails.length === 0) {
    throw new Error("AUTHORIZED_SENDERS must contain at least one valid entry");
  }

  return {
    authorizedDomains: [...new Set(authorizedDomains)],
    authorizedEmails: [...new Set(authorizedEmails)],
  };
}

/** Creates configuration from required environment variables with explicit overrides. */
export function createConfig(env?: Env, overrides?: Partial<AppConfig>): AppConfig {
  const llmOverride = overrides?.llm;
  const authorization =
    overrides?.authorization ?? parseAuthorizationPolicy(env?.AUTHORIZED_SENDERS);

  const defaultModels = {
    primeFoo: ORCHESTRATOR_CONFIG,
    leaveFoo: SPECIALIST_CONFIG,
    paceFoo: SPECIALIST_CONFIG,
    doadFoo: SPECIALIST_CONFIG,
    qroFoo: SPECIALIST_CONFIG,
    memoryFoo: SPECIALIST_CONFIG,
  };

  return {
    email: overrides?.email ?? {
      agentFromEmail: "agent@caf-gpt.com",
      monitoredAddresses: ["agent@caf-gpt.com", "pacenote@caf-gpt.com"],
    },
    authorization,
    llm: {
      models: llmOverride?.models ?? defaultModels,
    },
  };
}
