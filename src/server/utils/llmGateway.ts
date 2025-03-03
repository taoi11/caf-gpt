/**
 * LLM API gateway that manages communication with external language model providers.
 * Handles request formatting, concurrent connection management, system prompting,
 * response processing, and error handling while integrating with the cost tracking system.
 */
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

// LLM Gateway class
class LLMGateway {
    private activeRequests = 0;
    public async validateApiKey(apiKey?: string): Promise<boolean> {
        try {
            const keyToValidate = apiKey || OPENROUTER_API_KEY;
            // Validate API key
            if (!keyToValidate) {
                logger.warn('No API key provided for validation');
                return false;
            }
            // Fetch API key validation response
            const response = await fetch(OPENROUTER_AUTH_URL, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${keyToValidate}`,
                }
            });
            // Return true if response is successful
            return response.ok;
        } catch (error) {
            // Log error
            logger.error('API key validation failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return false;
        }
    }
    // Executes LLM request with concurrency control and logging
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
            // Fetch LLM response
            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`
                },
                body: JSON.stringify(requestBody)
            });
            // Check if response is successful
            if (!response.ok) {
                const error = await response.json();
                throw this.handleError(error);
            }
            // Parse LLM response
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
            // Log error
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
    // Prepares messages for LLM request
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
    // Handles OpenRouter API errors
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
