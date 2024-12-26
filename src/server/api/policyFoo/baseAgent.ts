import { llmGateway } from '../utils/llmGateway';
import { logger } from '../../logger';
import { rateLimiter } from '../utils/rateLimiter';
import type { Message } from '../../../types';
import { IncomingMessage } from 'http';

export interface BaseAgentOptions {
    systemPrompt?: string;
    model?: string;
    temperature?: number;
}

export abstract class BaseAgent {
    protected readonly llmGateway = llmGateway;
    protected readonly options: BaseAgentOptions;

    constructor(options: BaseAgentOptions = {}) {
        this.options = options;
    }

    protected async checkRateLimit(req: IncomingMessage): Promise<boolean> {
        if (!rateLimiter.canMakeRequest(req)) {
            logger.warn('Rate limit exceeded for policy request');
            return false;
        }
        return true;
    }

    protected async query(messages: Message[], systemPrompt?: string): Promise<string> {
        try {
            const response = await this.llmGateway.query({
                messages,
                systemPrompt: systemPrompt || this.options.systemPrompt,
                model: this.options.model,
                temperature: this.options.temperature
            });
            return response.content;
        } catch (error) {
            logger.error('LLM query failed:', error);
            throw new Error('Failed to process request');
        }
    }

    // Method to be implemented by child agents
    abstract process(input: string, context?: any): Promise<any>;
} 