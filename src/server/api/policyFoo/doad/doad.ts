import { PolicyHandler } from '../policyFoo.js';
import { Message, LLMInteractionData } from '../../../types.js';
import { logger } from '../../../utils/logger.js';
import { MODELS } from '../../../utils/config.js';
import { createDOADFinder } from './agents/doadFinder.js';
import { createDOADChat } from './agents/doadChat.js';
import { s3Utils } from '../../../utils/s3Client.js';
import { IncomingMessage } from 'http';
import { DOADFinder, DOADChat, ChatResponse, DOADImplementation } from './types.js';

// Base implementation for DOAD handlers
export const baseDOADImplementation: DOADImplementation = {
    validateRequest(message: string): boolean {
        return message.trim().length > 0;
    },
    
    formatResponse(response: ChatResponse): ChatResponse {
        return {
            answer: response.answer || '',
            citations: response.citations || [],
            followUp: response.followUp || ''
        };
    },
    
    getDOADPath(doadNumber: string): string {
        const cleaned = doadNumber
            .trim()
            .replace(/\s+/g, '')
            .replace(/[^\d-]/g, '');
        return `doad/${cleaned}.md`;
    },
    
    isValidDOADNumber(doadNumber: string): boolean {
        const cleaned = doadNumber
            .trim()
            .replace(/\s+/g, '')
            .replace(/[^\d-]/g, '');
        return /^\d{5}-\d$/.test(cleaned);
    },
    
    extractDOADNumbers(text: string): string[] {
        const doadPattern = /\b\d{5}-\d\b/g;
        const matches = text.match(doadPattern) || [];
        return [...new Set(
            matches
                .map(match => match.trim().replace(/\s+/g, ''))
                .filter(match => this.isValidDOADNumber(match))
        )];
    },

    async getDOADContent(doadNumber: string): Promise<string> {
        const path = this.getDOADPath(doadNumber);
        logger.debug(`Fetching DOAD content from path: ${path}`);
        return await s3Utils.fetchRawContent(path);
    },

    // Shared logging methods
    logAgentInteraction(type: 'finder' | 'chat', data: LLMInteractionData) {
        logger.logLLMInteraction({
            ...data,
            metadata: {
                ...data.metadata,
                agent: type,
                timestamp: new Date().toISOString()
            }
        });
    },

    logAgentError(type: 'finder' | 'chat', error: Error, metadata?: Record<string, any>) {
        logger.error(`Error in DOAD ${type}`, {
            error: error.message,
            stack: error.stack,
            agent: type,
            ...metadata,
            timestamp: new Date().toISOString()
        });
    }
};

// DOAD Manager interface
interface DOADManager extends PolicyHandler, DOADImplementation {
    finder: DOADFinder;
    chat: DOADChat;
    models: typeof MODELS.doad;
    handleMessage(message: string, history?: Message[], req?: IncomingMessage): Promise<ChatResponse>;
}

// Create DOAD manager implementation
function createDOADManagerImpl(): DOADManager {
    const finder = createDOADFinder();
    const chat = createDOADChat();

    return {
        ...baseDOADImplementation,
        finder,
        chat,
        models: MODELS.doad,

        async handleMessage(message: string, history?: Message[], req?: IncomingMessage): Promise<ChatResponse> {
            try {
                // 1. Find relevant policies with history
                const policies = await this.finder.handleMessage(message, history);
                logger.debug(`Found ${policies.length} relevant policies`, {
                    policies,
                    messageLength: message.length,
                    hasHistory: !!history
                });
                
                // 2. Get policy contents from S3
                const policyContents = await Promise.all(
                    policies.map(async doadNumber => {
                        const content = await this.getDOADContent(doadNumber);
                        return { doadNumber, content };
                    })
                );
                
                // 3. Combine all policy contents into a single context
                const policyContext = policyContents
                    .map(({ doadNumber, content }) => {
                        if (!content) {
                            logger.warn(`Empty content for DOAD ${doadNumber}`);
                            return '';
                        }
                        return `<policy number="${doadNumber}">\n${content}\n</policy>`;
                    })
                    .join('\n\n');

                // 4. Send combined policy context + conversation history to chat agent
                return await this.chat.handleMessage(
                    message,
                    history || [],
                    policyContext,
                    req
                );
            } catch (error) {
                this.logAgentError('chat', error instanceof Error ? error : new Error(String(error)), {
                    messageLength: message.length,
                    hasHistory: !!history
                });
                throw error;
            }
        }
    };
}

// Factory function
export function createDOADHandler(): PolicyHandler {
    logger.info('Creating DOAD handler');
    return createDOADManagerImpl();
} 