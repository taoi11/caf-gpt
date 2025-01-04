import { logger } from './logger';
import { costTracker } from './costTracker.js';
import type { LLMRequest, LLMResponse, LLMError, Message, SystemMessage } from './types.js';

// Connection pool configuration
const MAX_CONCURRENT_REQUESTS = 50;
const DEFAULT_MAX_CONTEXT = 10; // Default number of messages to keep in context

// OpenRouter configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = process.env.LLM_API_KEY || '';
const LLM_MODEL = process.env.PACE_NOTE_MODEL || '';

class LLMGateway {
    private activeRequests = 0;

    public async query(request: LLMRequest): Promise<LLMResponse> {
        try {
            // Wait if too many active requests
            if (this.activeRequests >= MAX_CONCURRENT_REQUESTS) {
                throw new Error('Too many concurrent requests');
            }
            this.activeRequests++;

            // Prepare messages with system prompt if provided
            const messages = this.prepareMessages(request);

            logger.debug('Sending request to OpenRouter', {
                model: request.model || LLM_MODEL,
                messageCount: messages.length
            });

            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`
                },
                body: JSON.stringify({
                    model: request.model || LLM_MODEL,
                    messages,
                    temperature: request.temperature || 0.7
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw this.handleError(error);
            }

            const result = await response.json();
            const llmResponse: LLMResponse = {
                content: result.choices[0].message.content,
                model: result.model,
                usage: result.usage
            };

            // Track costs
            if (result.usage) {
                await costTracker.trackUsage(result.usage);
            }

            logger.logLLMInteraction({
                role: 'assistant',
                content: llmResponse.content,
                metadata: {
                    model: llmResponse.model,
                    usage: llmResponse.usage
                }
            });

            return llmResponse;

        } catch (error) {
            logger.error('LLM request failed:', error);
            throw error;
        } finally {
            this.activeRequests--;
        }
    }

    private prepareMessages(request: LLMRequest): (Message | SystemMessage)[] {
        let messages = request.messages;

        // Apply context length limit if specified
        const maxContext = request.maxContextLength || DEFAULT_MAX_CONTEXT;
        if (messages.length > maxContext) {
            messages = messages.slice(-maxContext);
            logger.debug('Trimmed conversation history', {
                originalLength: request.messages.length,
                trimmedLength: messages.length
            });
        }

        // Add system prompt if provided
        if (request.systemPrompt) {
            const systemMessage: SystemMessage = {
                role: 'system',
                content: request.systemPrompt
            };
            return [systemMessage, ...messages];
        }

        return messages;
    }

    private handleError(error: any): LLMError {
        // Map OpenRouter error to our error type
        const errorType = error.error?.type || 'api_error';
        return {
            code: error.error?.code || 'unknown',
            message: error.error?.message || 'Unknown error occurred',
            type: errorType as LLMError['type']
        };
    }
}

// Export singleton instance
export const llmGateway = new LLMGateway(); 