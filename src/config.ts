/**
 * src/config.ts
 *
 * Application configuration
 *
 * Top-level declarations:
 * - AppConfig: Overall application configuration interface
 * - STATIC_AUTHORIZATION_POLICY: Code-reviewed sender allowlist
 * - createConfig: Creates configuration with optional test overrides
 */

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

const STATIC_AUTHORIZATION_POLICY: Readonly<AuthorizationConfig> = {
  authorizedDomains: ["forces.gc.ca"],
  authorizedEmails: ["luffy@luffy.email", "munshi@dhaliwal.info"],
};

interface EmailConfig {
  agentFromEmail: string;
  monitoredAddresses: string[];
}

// Main model config - handles multi-turn conversations, coordination, and tool use.
const ORCHESTRATOR_CONFIG: LLMModelConfig = {
  model: "openai/gpt-5.4",
  temperature: 0,
  maxOutputTokens: 16384,
};

// Small model config - focused document Q&A, selection, and generation.
const SPECIALIST_CONFIG: LLMModelConfig = {
  model: "openai/gpt-5.4-mini",
  temperature: 0,
  maxOutputTokens: 16384,
};

// Overall application configuration interface
export interface AppConfig {
  email: EmailConfig;
  authorization: AuthorizationConfig;
  llm: LLMConfig;
}

/** Creates configuration from code-reviewed policy with explicit test overrides. */
export function createConfig(_env?: Env, overrides?: Partial<AppConfig>): AppConfig {
  const llmOverride = overrides?.llm;
  const authorization = overrides?.authorization ?? {
    authorizedDomains: [...STATIC_AUTHORIZATION_POLICY.authorizedDomains],
    authorizedEmails: [...STATIC_AUTHORIZATION_POLICY.authorizedEmails],
  };

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
