import { logger } from '../../logger';
import { costTracker } from './costTracker';
import type { LLMRequest, LLMResponse, LLMError, Message, MessageRole } from '../../../types';

// Connection pool configuration
const MAX_CONCURRENT_REQUESTS = 50;
const MESSAGE_TRIM_LENGTH = 100;

// OpenRouter configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = process.env.LLM_API_KEY || '';
const LLM_MODEL = process.env.PACE_NOTE_MODEL || '';

function trimMessage(message: { role: MessageRole; content: string }): { role: MessageRole; content: string } {
    if (message.content.length <= MESSAGE_TRIM_LENGTH * 2) {
        return message;
    }
    return {
        role: message.role,
        content: `${message.content.slice(0, MESSAGE_TRIM_LENGTH)}...${message.content.slice(-MESSAGE_TRIM_LENGTH)}`
    };
}

class LLMGateway {
    private activeRequests: number = 0;
    private requestQueue: Array<{
        resolve: (value: LLMResponse) => void;
        reject: (error: LLMError) => void;
        request: LLMRequest;
    }> = [];

    private async makeRequest(request: LLMRequest): Promise<LLMResponse> {
        const messages = request.systemPrompt 
            ? [{ role: 'system' as MessageRole, content: request.systemPrompt }, ...request.messages]
            : request.messages;

        // Log trimmed messages
        logger.debug('Request messages:', messages.map(m => trimMessage(m)));

        const body = {
            model: request.model || LLM_MODEL,
            messages,
            temperature: request.temperature ?? 0.1,
            stream: false
        };

        logger.debug('Making LLM request', { 
            model: body.model, 
            messageCount: messages.length,
            roles: messages.map(m => m.role).join(',')
        });

        const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'https://caf-gpt.pages.dev'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error('LLM request failed:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText
            });

            const error: LLMError = {
                code: response.status.toString(),
                message: errorText,
                type: this.mapErrorType(response.status)
            };
            throw error;
        }

        const data = await response.json();
        const responseMessage = { 
            role: 'assistant' as MessageRole, 
            content: data.choices[0].message.content 
        };

        // Track request cost
        await costTracker.trackRequest({
            id: data.id,
            model: data.model,
            cost: data.usage.total_tokens * 0.0000015, // Example rate, adjust based on model
            tokens: {
                prompt: data.usage.prompt_tokens,
                completion: data.usage.completion_tokens,
                total: data.usage.total_tokens
            }
        });

        logger.debug('LLM response received', {
            model: data.model,
            usage: data.usage,
            response: trimMessage(responseMessage)
        });

        return {
            content: responseMessage.content,
            model: data.model,
            usage: {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens
            }
        };
    }

    private mapErrorType(status: number): LLMError['type'] {
        switch (status) {
            case 429:
                return 'rate_limit';
            case 400:
                return 'invalid_request';
            case 401:
            case 403:
                return 'api_error';
            default:
                return 'connection_error';
        }
    }

    private async processQueue() {
        if (this.requestQueue.length === 0 || this.activeRequests >= MAX_CONCURRENT_REQUESTS) {
            return;
        }

        const { resolve, reject, request } = this.requestQueue.shift()!;
        this.activeRequests++;
        logger.debug(`Processing queue - Active requests: ${this.activeRequests}, Queued: ${this.requestQueue.length}`);

        try {
            const response = await this.makeRequest(request);
            resolve(response);
        } catch (error) {
            logger.error('Queue processing error:', error);
            reject(error as LLMError);
        } finally {
            this.activeRequests--;
            this.processQueue();
        }
    }

    public async query(request: LLMRequest): Promise<LLMResponse> {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ resolve, reject, request });
            logger.debug(`Request queued - Queue length: ${this.requestQueue.length}`);
            this.processQueue();
        });
    }

    // Helper method to create a conversation
    public createConversation(systemPrompt?: string, model?: string): Conversation {
        logger.debug('Creating new conversation', { 
            hasSystemPrompt: !!systemPrompt,
            model: model || LLM_MODEL,
            systemPrompt: systemPrompt ? trimMessage({ role: 'system' as MessageRole, content: systemPrompt }) : undefined
        });
        return new Conversation(this, systemPrompt, model);
    }
}

// Conversation class to handle message history
class Conversation {
    private messages: Message[] = [];
    private readonly gateway: LLMGateway;
    private readonly systemPrompt?: string;
    private readonly model?: string;

    constructor(gateway: LLMGateway, systemPrompt?: string, model?: string) {
        this.gateway = gateway;
        this.systemPrompt = systemPrompt;
        this.model = model;
        logger.debug('Conversation initialized', { 
            hasSystemPrompt: !!systemPrompt,
            model: model || LLM_MODEL,
            systemPrompt: systemPrompt ? trimMessage({ role: 'system' as MessageRole, content: systemPrompt }) : undefined
        });
    }

    public async sendMessage(content: string): Promise<string> {
        const userMessage = { role: 'user' as MessageRole, content };
        this.messages.push(userMessage);
        logger.debug('Sending message', { 
            messageCount: this.messages.length,
            message: trimMessage(userMessage)
        });

        const response = await this.gateway.query({
            messages: this.messages,
            systemPrompt: this.systemPrompt,
            model: this.model,
        });

        const assistantMessage = { role: 'assistant' as MessageRole, content: response.content };
        this.messages.push(assistantMessage);
        logger.debug('Response received', {
            messageCount: this.messages.length,
            response: trimMessage(assistantMessage)
        });

        return response.content;
    }

    public getHistory(): Message[] {
        return [...this.messages];
    }

    public clearHistory(): void {
        logger.debug('Clearing conversation history', { 
            messageCount: this.messages.length,
            messages: this.messages.map(m => trimMessage(m))
        });
        this.messages = [];
    }
}

logger.info('Initializing LLM Gateway');
// Export singleton instance
export const llmGateway = new LLMGateway(); 