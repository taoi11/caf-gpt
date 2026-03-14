/**
 * src/agents/utils/PromptManager.ts
 *
 * Prompt manager for loading prompt assets and rendering variable placeholders
 *
 * Top-level declarations:
 * - PromptManager: Manages loading of prompts and caching raw prompt strings
 * - getPrompt: Loads raw prompt content from static assets by name
 * - renderPrompt: Renders system prompt placeholders and user input payload
 */

import { formatError, Logger } from "../../Logger";

interface RenderedPrompt {
  system: string;
  user: string;
}

export class PromptManager {
  private logger: Logger;
  private promptCache = new Map<string, string>();

  constructor(private assets: Fetcher) {
    this.logger = Logger.getInstance();
  }

  async getPrompt(promptName: string): Promise<string> {
    const cached = this.promptCache.get(promptName);
    if (cached) {
      this.logger.debug("Returning cached prompt", { promptName });
      return cached;
    }

    try {
      const assetResponse = await this.assets.fetch(
        new Request(`https://assets.local/prompts/${promptName}.md`)
      );

      if (assetResponse.ok) {
        const content = await assetResponse.text();
        this.promptCache.set(promptName, content);
        this.logger.debug("Loaded prompt from static assets", { promptName });
        return content;
      }
    } catch (error) {
      this.logger.warn("Failed to load prompt from static assets", {
        promptName,
        ...formatError(error),
      });
    }

    throw new Error(`Prompt '${promptName}' not found in static assets`);
  }

  // Render prompt variables and return system+user strings for model calls
  async renderPrompt(
    promptName: string,
    variables: Record<string, string | undefined>
  ): Promise<RenderedPrompt> {
    const rawPrompt = await this.getPrompt(promptName);
    const userInput = variables.user_input ?? "";

    const system = rawPrompt.replaceAll(/\{([a-zA-Z0-9_]+)\}/g, (_match, key: string) => {
      if (key === "user_input") {
        return "";
      }
      return variables[key] ?? `{${key}}`;
    });

    return {
      system,
      user: userInput,
    };
  }
}
