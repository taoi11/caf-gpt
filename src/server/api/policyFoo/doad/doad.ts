import type { Message, LLMInteractionData, DOADFinder, DOADImplementation, ChatResponse, PolicyHandler, DOADLogger, DOADChat } from '../../../types';
import type { FormattedPolicyHandler, ResponseFormatter } from '../policyFoo';
import { logger } from '../../../utils/logger';
import { MODELS } from '../../../utils/config';
import { createDOADFinder } from './agents/doadFinder';
import { createDOADChat } from './agents/doadChat';
import { s3Utils } from '../../../utils/s3Client';
import { IncomingMessage } from 'http';

// Merged interface for implementation
interface DOADManagerImpl extends DOADImplementation, DOADLogger, ResponseFormatter {}

// Base implementation for DOAD handlers
export const baseDOADImplementation: DOADManagerImpl = {
    validateRequest(message: string): boolean {
        return message.trim().length > 0;
    },
    
    formatResponse(response: ChatResponse): ChatResponse {
        return {
            answer: response.answer || '',
            citations: response.citations || [],
            followUp: response.followUp || undefined
        };
    },
    
    async initialize(): Promise<void> {
        logger.debug('Initializing DOAD implementation');
        // Perform any necessary initialization here
    },
    
    getDOADPath(doadNumber: string): string {
        const cleaned = doadNumber
            .trim()
            .replace(/\s+/g, '')
            .replace(/[^\d-]/g, '');
        return `doad/${cleaned}.md`;
    },
    
    isValidDOADNumber(doadNumber: string): boolean {
        // Match pattern like 1234-5 or 12345-6
        const pattern = /^\d{4,5}-\d+$/;
        return pattern.test(doadNumber);
    },
    
    extractDOADNumbers(text: string): string[] {
        // Match DOAD numbers in format like DOAD 1234-5 or just 1234-5
        const pattern = /(?:DOAD\s*)?(\d{4,5}-\d+)/gi;
        const matches = text.match(pattern) || [];
        return matches.map(match => match.replace(/DOAD\s*/i, ''));
    },
    
    async getDOADContent(doadNumber: string): Promise<string> {
        const path = this.getDOADPath(doadNumber);
        logger.debug(`Fetching DOAD content from path: ${path}`);
        return await s3Utils.fetchRawContent(path);
    },
    
    logAgentInteraction(type: 'finder' | 'chat', data: LLMInteractionData) {
        logger.logLLMInteraction({
            ...data,
            metadata: {
                ...data.metadata,
                agent: type
            }
        });
    },
    
    logAgentError(type: 'finder' | 'chat', error: Error, metadata: Record<string, unknown> = {}) {
        logger.error(`DOAD ${type} error: ${error.message}`, {
            ...metadata,
            agent: type,
            error: error.message,
            stack: error.stack
        });
    }
};

// DOAD Manager interface
export interface DOADManager extends FormattedPolicyHandler, DOADManagerImpl {
    finder: DOADFinder;
    chat: DOADChat;
    models: typeof MODELS.doad;
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
                const err = error instanceof Error ? error : new Error('Unknown error');
                this.logAgentError('chat', err, {
                    messageLength: message.length,
                    hasHistory: !!history
                });
                
                return {
                    answer: 'I encountered an error trying to access the policy information. Please try again or contact support if the problem persists.',
                    citations: [],
                    followUp: 'Try rephrasing your question or asking about a specific policy.'
                };
            }
        }
    };
}

// Factory function
export function createDOADHandler(): PolicyHandler {
    logger.info('Creating DOAD handler');
    return createDOADManagerImpl();
} 