import { CONFIG } from '../../config';
import { logger } from '../../logger';
import type { LLMRequest, LLMResponse, LLMError, Message, MessageRole } from '../../../types';

// Connection pool configuration
const MAX_CONCURRENT_REQUESTS = 50;
const REQUEST_TIMEOUT = 30000; // 30 seconds
const RETRY_ATTEMPTS = 2;
const MESSAGE_TRIM_LENGTH = 100;

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
            model: request.model || CONFIG.llm.models.paceNote, // Use provided model or default
            messages,
            temperature: request.temperature ?? 0.1, // Low temperature for consistent responses
            stream: false,    // Always false for our use case
        };

        logger.debug('Making LLM request', { 
            model: body.model, 
            messageCount: messages.length,
            roles: messages.map(m => m.role).join(',')
        });

        const response = await fetch(`${CONFIG.cloudflare.endpoint}/openrouter/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.llm.apiKey}`,
                'cf-aig-authorization': `Bearer ${CONFIG.cloudflare.gatewayApiKey}`,
            },
            body: JSON.stringify(body),
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
                type: 'api_error',
            };
            throw error;
        }

        const data = await response.json();
        const responseMessage = { 
            role: 'assistant' as MessageRole, 
            content: data.choices[0].message.content 
        };

        logger.debug('LLM response received', {
            model: data.model,
            usage: data.usage,
            response: trimMessage(responseMessage)
        });

        return {
            content: responseMessage.content,
            model: data.model,
            usage: data.usage,
        };
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
            model: model || CONFIG.llm.models.paceNote,
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
            model: model || CONFIG.llm.models.paceNote,
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