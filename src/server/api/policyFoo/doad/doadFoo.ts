import { PolicyHandler } from '../policyFoo';
import { ChatResponse, Message } from '../../../../types';
import { logger } from '../../../logger';
import { MODELS } from '../../../config';
import { createDOADFinder } from './agents/finderAgent';
import { createDOADReader } from './agents/readerAgent';
import { createDOADChat } from './agents/chatAgent';
import { rateLimiter } from '../../../api/utils/rateLimiter';
import { IncomingMessage } from 'http';

// Base interface for DOAD handlers
export interface DOADHandler {
    getDOADPath(doadNumber: string): string;
    isValidDOADNumber(doadNumber: string): boolean;
    extractDOADNumbers(text: string): string[];
}

// Specific interfaces for each agent type
export interface DOADFinder extends DOADHandler {
    handleMessage(message: string): Promise<string[]>;
}

export interface DOADReader extends DOADHandler {
    handleMessage(message: string, history?: Message[]): Promise<ChatResponse>;
}

export interface DOADChat extends DOADHandler {
    handleMessage(message: string, history?: Message[], req?: IncomingMessage): Promise<ChatResponse>;
}

// Base implementation for DOAD handlers
export const baseDOADImplementation = {
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
        return `/doad/${doadNumber.trim()}.md`;
    },
    
    isValidDOADNumber(doadNumber: string): boolean {
        // Just check if it has a number, dash, and number format
        return doadNumber.includes('-');
    },
    
    extractDOADNumbers(text: string): string[] {
        const doadPattern = /\b\d{5}-\d\b/g;
        return [...new Set(text.match(doadPattern) || [])];
    }
};

// DOAD Manager interface
interface DOADManager extends PolicyHandler {
    finder: DOADFinder;
    reader: DOADReader;
    chat: DOADChat;
    models: typeof MODELS.doad;
    handleMessage(message: string, history?: Message[], req?: IncomingMessage): Promise<ChatResponse>;
}

// Create DOAD manager implementation
function createDOADManagerImpl(): DOADManager {
    const finder = createDOADFinder();
    const reader = createDOADReader();
    const chat = createDOADChat();

    return {
        ...baseDOADImplementation,
        finder,
        reader,
        chat,
        models: MODELS.doad,

        async handleMessage(message: string, history?: Message[], req?: IncomingMessage): Promise<ChatResponse> {
            try {
                logger.info('Starting DOAD agent chain');

                // 1. Find relevant policies (don't track rate limit)
                const policies = await this.finder.handleMessage(message);
                
                if (policies.length === 0) {
                    return {
                        answer: 'No relevant policies found.',
                        citations: [],
                        followUp: ''
                    };
                }

                // 2. Read policies (don't track rate limit)
                const readerPromises = policies.map((policy, index) => 
                    new Promise<string>(async (resolve) => {
                        // Add delay offset for each policy
                        await new Promise(r => setTimeout(r, index * 250));
                        try {
                            const response = await this.reader.handleMessage(message, [
                                { role: 'user', content: message },
                                { role: 'assistant', content: policy }
                            ]);
                            resolve(response.answer);
                        } catch (error) {
                            logger.error(`Error reading policy ${policy}:`, error);
                            resolve(''); // Skip failed policies
                        }
                    })
                );

                const policyContents = await Promise.all(readerPromises);

                // 3. Chat response (track rate limit only for this)
                const chatResponse = await this.chat.handleMessage(message, [
                    { role: 'user', content: message },
                    { role: 'assistant', content: policyContents.join('\n\n') }
                ], req);

                return chatResponse;
            } catch (error) {
                logger.error('Error in DOAD chain:', error);
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