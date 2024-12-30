import { PolicyHandler } from '../policyFoo';
import { ChatResponse, Message } from '../../../../types';
import { logger } from '../../../logger';
import { MODELS } from '../../../config';
import { createDOADFinder } from './agents/finderAgent';
import { createDOADReader } from './agents/readerAgent';
import { createDOADChat } from './agents/chatAgent';
import { s3Client } from '../../../api/utils/s3Client';
import { IncomingMessage } from 'http';
import { GetObjectCommand } from '@aws-sdk/client-s3';

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
    handleMessage(
        message: string, 
        history?: Message[], 
        req?: IncomingMessage,
        policyContext?: string
    ): Promise<ChatResponse>;
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
        // Clean the policy number before creating path
        const cleaned = doadNumber
            .trim()
            .replace(/\s+/g, '')
            .replace(/[^\d-]/g, '');
        return `doad/${cleaned}.md`;
    },
    
    isValidDOADNumber(doadNumber: string): boolean {
        // Clean the policy number
        const cleaned = doadNumber
            .trim()
            .replace(/\s+/g, '')     // Remove all whitespace
            .replace(/[^\d-]/g, ''); // Keep only digits and hyphen
        
        // Strict DOAD format validation (5 digits, hyphen, 1 digit)
        return /^\d{5}-\d$/.test(cleaned);
    },
    
    extractDOADNumbers(text: string): string[] {
        // Enhanced DOAD pattern matching
        const doadPattern = /\b\d{5}-\d\b/g;
        const matches = text.match(doadPattern) || [];
        
        // Clean and validate each match
        return [...new Set(
            matches
                .map(match => match.trim().replace(/\s+/g, ''))
                .filter(match => this.isValidDOADNumber(match))
        )];
    },

    async getDOADContent(doadNumber: string): Promise<string> {
        try {
            const path = this.getDOADPath(doadNumber);
            const response = await s3Client.send(new GetObjectCommand({
                Bucket: process.env.S3_BUCKET || 'policies',
                Key: path
            }));

            return response.Body?.toString() || '';
        } catch (error) {
            logger.error(`Failed to get DOAD ${doadNumber}:`, error);
            return '';
        }
    }
};

// DOAD Manager interface
interface DOADManager extends PolicyHandler {
    finder: DOADFinder;
    reader: DOADReader;
    chat: DOADChat;
    models: typeof MODELS.doad;
    getDOADContent(doadNumber: string): Promise<string>;
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
                // 1. Find relevant policies
                const policies = await this.finder.handleMessage(message);
                logger.debug(`Found ${policies.length} relevant policies`);
                
                // 2. Get policy contents from S3
                const policyContents = await Promise.all(
                    policies.map(async doadNumber => {
                        const content = await this.getDOADContent(doadNumber);
                        return { doadNumber, content };
                    })
                );
                
                // 3. Have reader process each policy
                const readerPromises = policyContents.map(({ content }) => {
                    logger.debug('Policy content before reader:', content); // Add debug log
                    return this.reader.handleMessage(
                        message,
                        [{ role: 'system', content: content.toString() }] // Ensure string conversion
                    );
                });
                
                // Wait for all reader responses
                const readerResponses = await Promise.all(readerPromises);
                
                // 4. Combine all XML responses into single context
                const policyContext = readerResponses
                    .map(r => r.answer)  // Each answer is an XML response
                    .join('\n\n');       // Join with double newline for readability

                // 5. Send combined XML context + conversation history to chat agent
                const chatResponse = await this.chat.handleMessage(
                    message,
                    [
                        // Policy extracts will be handled by chatAgent's system prompt
                        // Only include conversation history, excluding system messages
                        ...(history?.filter(msg => 
                            msg.role !== 'system' && 
                            !(msg.role === 'user' && msg.content === message)
                        ) || [])
                    ],
                    req,
                    policyContext  // Pass policy context separately for system prompt
                );

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