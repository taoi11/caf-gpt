import { logger } from './logger';
import { costTracker } from './costTracker';
import type { LLMRequest, LLMResponse, LLMError, Message, SystemMessage } from '../types';
import { randomUUID } from 'crypto';

// Connection pool configuration
const MAX_CONCURRENT_REQUESTS = 50;
const DEFAULT_MAX_CONTEXT = 10; // Default number of messages to keep in context
const DEFAULT_TEMPERATURE = 0.1; // Default to low temperature for more consistent responses

// OpenRouter configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_AUTH_URL = 'https://openrouter.ai/api/v1/auth/key';
const OPENROUTER_API_KEY = process.env.LLM_API_KEY || '';
const LLM_MODEL = process.env.PACE_NOTE_MODEL || '';

/**
 * LLM API gateway that manages communication with external language model providers.
 * Handles request formatting, concurrent connection management, system prompting,
 * response processing, and error handling while integrating with the cost tracking system.
 */
class LLMGateway {
    /**
     * Manages concurrent LLM API connections using a simple pool pattern.
     * Ensures we never exceed MAX_CONCURRENT_REQUESTS simultaneous requests
     * by tracking active request count and queueing when necessary.
     */
    private activeRequests = 0;

    /**
     * Validates if the OpenRouter API key is valid
     * @param apiKey - Optional API key to validate (uses environment API key if not provided)
     * @returns True if the API key is valid, false otherwise
     */
    public async validateApiKey(apiKey?: string): Promise<boolean> {
        try {
            const keyToValidate = apiKey || OPENROUTER_API_KEY;
            
            if (!keyToValidate) {
                logger.warn('No API key provided for validation');
                return false;
            }

            const response = await fetch(OPENROUTER_AUTH_URL, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${keyToValidate}`,
                }
            });
            
            return response.ok;
        } catch (error) {
            logger.error('API key validation failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return false;
        }
    }

    /**
     * Executes LLM request with concurrency control and logging
     * @param request - LLM request parameters including messages and model config
     * @returns Processed LLM response
     * @throws LLMError for API failures or rate limits
     */
    public async query(request: LLMRequest): Promise<LLMResponse> {
        try {
            // Wait if too many active requests
            if (this.activeRequests >= MAX_CONCURRENT_REQUESTS) {
                throw new Error('Too many concurrent requests');
            }
            this.activeRequests++;

            // Generate request ID
            const requestId = randomUUID();

            // Prepare messages with system prompt if provided
            const messages = this.prepareMessages(request);

            // Prepare complete request body
            const requestBody = {
                model: request.model || LLM_MODEL,
                messages,
                temperature: request.temperature || DEFAULT_TEMPERATURE
            };

            // Log request
            logger.logLLMInteraction({
                role: 'system',
                content: request.systemPrompt || '',
                metadata: {
                    requestId,
                    type: 'request',
                    model: requestBody.model,
                    temperature: requestBody.temperature,
                    messages: requestBody.messages,
                    timestamp: new Date().toISOString()
                }
            });

            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`
                },
                body: JSON.stringify(requestBody)
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

            // Log response with same request ID
            logger.logLLMInteraction({
                role: 'assistant',
                content: llmResponse.content,
                metadata: {
                    requestId,
                    type: 'response',
                    model: llmResponse.model,
                    usage: llmResponse.usage,
                    timestamp: new Date().toISOString(),
                    rawResponse: result // Include full response for debugging
                }
            });

            return llmResponse;

        } catch (error) {
            const err = error instanceof Error ? error : new Error('Unknown error');
            logger.error('LLM request failed', {
                error: err.message,
                stack: err.stack,
                model: request.model || LLM_MODEL,
                messageCount: request.messages.length,
                temperature: request.temperature || DEFAULT_TEMPERATURE
            });
            throw error;
        } finally {
            this.activeRequests--;
        }
    }

    /**
     * Processes message history for LLM requests:
     * - Applies context window limits
     * - Prepends system prompt if provided
     * - Trims long system messages in dev mode
     * @param request - LLM request parameters
     * @returns Prepared messages array for API consumption
     */
    private prepareMessages(request: LLMRequest): (Message | SystemMessage)[] {
        let messages = request.messages;

        // Apply context length limit if specified
        const maxContext = request.maxContextLength || DEFAULT_MAX_CONTEXT;
        if (messages.length > maxContext) {
            messages = messages.slice(-maxContext);
            logger.debug('Trimmed conversation history', {
                originalLength: request.messages.length,
                trimmedLength: messages.length,
                maxContext
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

    /**
     * Maps OpenRouter API errors to standardized LLMError format
     * @param error - Raw error from API response
     * @returns Normalized error object with classification
     */
    private handleError(error: unknown): LLMError {
        // Map OpenRouter error to our error type
        const errorObj = error as { error?: { type?: string, code?: string, message?: string } };
        const errorType = errorObj.error?.type || 'api_error';
        return {
            code: errorObj.error?.code || 'unknown',
            message: errorObj.error?.message || 'Unknown error occurred',
            type: errorType as LLMError['type']
        };
    }
}

// Export singleton instance
export const llmGateway = new LLMGateway(); 
