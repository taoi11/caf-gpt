/**
 * src/config.ts
 *
 * Application configuration
 *
 * Top-level declarations:
 * - AppConfig: Overall application configuration interface
 * - createConfig: Creates configuration from environment variables with overrides
 */

interface LLMModelConfig {
  model: string;
  temperature: number;
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

interface AuthorizationConfig {
  authorizedDomains: string[];
  authorizedEmails: string[];
}

interface EmailConfig {
  agentFromEmail: string;
  monitoredAddresses: string[];
  webhookPath: string;
}

// Orchestrator model config - handles multi-turn conversations, coordination, tool use
const ORCHESTRATOR_CONFIG: LLMModelConfig = {
  model: "google/gemini-3-pro-preview",
  temperature: 0.1,
};

// Specialist model config - focused tasks: document Q&A, selection, generation
const SPECIALIST_CONFIG: LLMModelConfig = {
  model: "google/gemini-3-flash-preview",
  temperature: 0.1,
};

// Overall application configuration interface
export interface AppConfig {
  email: EmailConfig;
  authorization: AuthorizationConfig;
  llm: LLMConfig;
}

// Creates configuration from environment variables with overrides
export function createConfig(env?: Env, overrides?: Partial<AppConfig>): AppConfig {
  // Parse authorized senders from environment variable
  let authorizedDomains = ["forces.gc.ca"];
  let authorizedEmails: string[] = ["luffy@luffy.email"];

  if (env?.AUTHORIZED_SENDERS) {
    const senders = env.AUTHORIZED_SENDERS.split(",").map((s: string) => s.trim());
    authorizedDomains = senders.filter((s: string) => !s.includes("@"));
    authorizedEmails = senders.filter((s: string) => s.includes("@"));
  }

  return {
    email: overrides?.email ?? {
      agentFromEmail: "agent@caf-gpt.com",
      monitoredAddresses: ["agent@caf-gpt.com", "pacenote@caf-gpt.com"],
      webhookPath: "/webhooks/resend",
    },
    authorization: overrides?.authorization ?? {
      authorizedDomains,
      authorizedEmails,
    },
    llm: overrides?.llm ?? {
      models: {
        primeFoo: ORCHESTRATOR_CONFIG,
        leaveFoo: SPECIALIST_CONFIG,
        paceFoo: SPECIALIST_CONFIG,
        doadFoo: SPECIALIST_CONFIG,
        qroFoo: SPECIALIST_CONFIG,
        memoryFoo: SPECIALIST_CONFIG,
      },
    },
  };
}
