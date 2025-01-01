import { logger } from './logger.js';
import type { LLMRequest, LLMResponse, LLMError, Message, MessageRole } from './types.js';

// Connection pool configuration
const MAX_CONCURRENT_REQUESTS = 50;
const DEFAULT_MAX_CONTEXT = 10; // Default number of messages to keep in context

// OpenRouter configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = process.env.LLM_API_KEY || '';
const LLM_MODEL = process.env.PACE_NOTE_MODEL || '';

class LLMGateway {
    private activeRequests: number = 0;
    private requestQueue: Array<{
        resolve: (value: LLMResponse) => void;
        reject: (error: LLMError) => void;
        request: LLMRequest;
    }> = [];

    private async makeRequest(request: LLMRequest): Promise<LLMResponse> {
        // Get messages and apply context limit if specified
        const messages = this.prepareMessages(request);

        // Log full messages to file
        logger.debug('Request messages:', messages);

        const body = {
            model: request.model || LLM_MODEL,
            messages,
            temperature: request.temperature ?? 0.1,
            stream: false
        };

        logger.debug('Making LLM request', { 
            model: body.model, 
            messageCount: messages.length,
            roles: messages.map(m => m.role).join(','),
            contextLength: request.maxContextLength || DEFAULT_MAX_CONTEXT
        });

        const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'https://caf-gpt.com',
                'X-Title': 'CAF-GPT'
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
        
        // Log full response data
        logger.debug('LLM response received:', data);

        return {
            content: data.choices[0].message.content,
            model: data.model,
            usage: data.usage ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens
            } : undefined
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
            systemPrompt: systemPrompt ? { role: 'system', content: systemPrompt } : undefined
        });
        return new Conversation(this, systemPrompt, model);
    }

    private prepareMessages(request: LLMRequest): Message[] {
        let messages = request.messages;

        // Apply context length limit if specified
        const maxContext = request.maxContextLength || DEFAULT_MAX_CONTEXT;
        if (messages.length > maxContext) {
            // Keep system message if present, then most recent messages
            const systemMessage = messages.find(m => m.role === 'system');
            const recentMessages = messages.slice(-maxContext);
            
            messages = systemMessage 
                ? [systemMessage, ...recentMessages]
                : recentMessages;

            logger.debug('Trimmed conversation history', {
                originalLength: request.messages.length,
                trimmedLength: messages.length
            });
        }

        return messages;
    }
}

// Conversation class to handle message history
class Conversation {
    private messages: Message[] = [];
    private readonly gateway: LLMGateway;
    private readonly systemPrompt?: string;
    private readonly model?: string;
    private readonly maxContextLength: number;

    constructor(
        gateway: LLMGateway, 
        systemPrompt?: string, 
        model?: string,
        maxContextLength: number = DEFAULT_MAX_CONTEXT
    ) {
        this.gateway = gateway;
        this.systemPrompt = systemPrompt;
        this.model = model;
        this.maxContextLength = maxContextLength;

        logger.debug('Conversation initialized', { 
            hasSystemPrompt: !!systemPrompt,
            model: model || LLM_MODEL,
            maxContextLength,
            systemPrompt: systemPrompt ? { role: 'system', content: systemPrompt } : undefined
        });
    }

    public async sendMessage(content: string): Promise<string> {
        const userMessage = { 
            role: 'user' as MessageRole, 
            content,
            timestamp: new Date().toISOString()
        };
        this.messages.push(userMessage);

        logger.debug('Sending message', { 
            messageCount: this.messages.length,
            message: userMessage
        });

        const response = await this.gateway.query({
            messages: this.messages,
            systemPrompt: this.systemPrompt,
            model: this.model,
            maxContextLength: this.maxContextLength
        });

        const assistantMessage = { 
            role: 'assistant' as MessageRole, 
            content: response.content,
            timestamp: new Date().toISOString()
        };
        this.messages.push(assistantMessage);

        logger.debug('Response received', {
            messageCount: this.messages.length,
            response: assistantMessage
        });

        return response.content;
    }

    public getHistory(): Message[] {
        return [...this.messages];
    }

    public clearHistory(): void {
        logger.debug('Clearing conversation history', { 
            messageCount: this.messages.length,
            messages: this.messages
        });
        this.messages = [];
    }
}

logger.info('Initializing LLM Gateway');
// Export singleton instance
export const llmGateway = new LLMGateway(); 