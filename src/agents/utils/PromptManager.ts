/**
 * src/agents/utils/PromptManager.ts
 *
 * Prompt manager for loading from static assets with ChatPromptTemplate caching
 *
 * Top-level declarations:
 * - PromptManager: Manages loading of prompts and caching compiled ChatPromptTemplates
 * - getPrompt: Loads raw prompt content from static assets by name
 * - getTemplate: Returns cached ChatPromptTemplate for system prompts with variables
 */

import { ChatPromptTemplate } from "@langchain/core/prompts";
import { formatError, Logger } from "../../Logger";

// Load prompts from static assets and cache compiled templates
export class PromptManager {
  private logger: Logger;
  private promptCache = new Map<string, string>();
  private templateCache = new Map<string, ChatPromptTemplate>();

  constructor(private assets: Fetcher) {
    this.logger = Logger.getInstance();
  }

  // Load raw prompt content from static assets
  async getPrompt(promptName: string): Promise<string> {
    // Check cache first
    const cached = this.promptCache.get(promptName);
    if (cached) {
      this.logger.debug("Returning cached prompt", { promptName });
      return cached;
    }

    try {
      // The domain in the URL doesn't matter for static assets - only the path is used
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

  // Get cached ChatPromptTemplate for system prompt with user input placeholder
  async getTemplate(promptName: string): Promise<ChatPromptTemplate> {
    // Check template cache first
    const cached = this.templateCache.get(promptName);
    if (cached) {
      this.logger.debug("Returning cached template", { promptName });
      return cached;
    }

    // Load raw prompt and compile to template
    const content = await this.getPrompt(promptName);
    // System message contains prompt-specific variables (e.g., {current_memory}, {leave_policy})
    // User message always uses {user_input} for the actual user question/content
    const template = ChatPromptTemplate.fromMessages([
      ["system", content],
      ["user", "{user_input}"],
    ]);

    this.templateCache.set(promptName, template);
    this.logger.debug("Compiled and cached template", { promptName });
    return template;
  }
}
