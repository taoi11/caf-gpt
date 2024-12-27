import { PolicyHandler } from '../policyFoo';
import { ChatResponse, Message } from '../../../../types';
import { logger } from '../../../logger';
import { MODELS } from '../../../config';
import { createDOADFinder } from './agents/finderAgent';
import { createDOADReader } from './agents/readerAgent';
import { createDOADChat } from './agents/chatAgent';

// Base interface for DOAD handlers
export interface DOADHandler extends PolicyHandler {
    getDOADPath(doadNumber: string): string;
    isValidDOADNumber(doadNumber: string): boolean;
    extractDOADNumbers(text: string): string[];
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
        return `/doad/${doadNumber}.md`;
    },
    
    isValidDOADNumber(doadNumber: string): boolean {
        return /^\d{5}-\d$/.test(doadNumber);
    },
    
    extractDOADNumbers(text: string): string[] {
        const doadPattern = /\b\d{5}-\d\b/g;
        return [...new Set(text.match(doadPattern) || [])];
    }
};

// DOAD Manager interface
interface DOADManager extends DOADHandler {
    finder: DOADHandler;
    reader: DOADHandler;
    chat: DOADHandler;
    models: typeof MODELS.doad;
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

        async handleMessage(message: string, history?: Message[]): Promise<ChatResponse> {
            try {
                logger.info('Starting DOAD agent chain');

                // Build conversation history for agents
                const conversationHistory: Message[] = [];
                if (history?.length) {
                    // Add previous conversation pairs
                    for (let i = 0; i < history.length; i += 2) {
                        if (history[i] && history[i + 1]) {
                            conversationHistory.push(
                                { role: 'user', content: history[i].content },
                                { role: 'assistant', content: history[i + 1].content }
                            );
                        }
                    }
                }

                // 1. Find relevant policies
                const finderResponse = await this.finder.handleMessage(message);
                if (!finderResponse.citations?.length) {
                    return finderResponse;
                }

                // Add finder result to history
                conversationHistory.push(
                    { role: 'user', content: message },
                    { role: 'assistant', content: finderResponse.answer }
                );

                // 2. Read policy content
                const readerResponse = await this.reader.handleMessage(
                    message,
                    conversationHistory
                );

                // Add reader result to history
                conversationHistory.push(
                    { role: 'assistant', content: readerResponse.answer }
                );

                // 3. Generate final response
                return this.chat.handleMessage(message, conversationHistory);

            } catch (error) {
                logger.error('Error in DOAD manager:', error);
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