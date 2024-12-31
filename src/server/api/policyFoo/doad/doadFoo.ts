import { PolicyHandler } from '../policyFoo';
import { Message } from '../../../../types';
import { logger } from '../../utils/logger';
import { MODELS } from '../../../config';
import { createDOADFinder } from './agents/finderAgent';
import { createDOADChat } from './agents/chatAgent';
import { s3Client } from '../../../api/utils/s3Client';
import { IncomingMessage } from 'http';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { DOADFinder, DOADChat, ChatResponse, DOADImplementation } from './types';

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
        try {
            const path = this.getDOADPath(doadNumber);
            logger.debug(`Fetching DOAD content from path: ${path}`);
            
            const response = await s3Client.send(new GetObjectCommand({
                Bucket: process.env.S3_BUCKET || 'policies',
                Key: path
            }));

            const content = await response.Body?.transformToString() || '';
            logger.debug(`Fetched DOAD ${doadNumber} content length: ${content.length}`);
            
            if (!content) {
                logger.warn(`Empty content received for DOAD ${doadNumber}`);
            }

            return content;
        } catch (error) {
            logger.error(`Failed to get DOAD ${doadNumber}:`, error);
            return '';
        }
    }
};

// DOAD Manager interface
interface DOADManager extends PolicyHandler {
    finder: DOADFinder;
    chat: DOADChat;
    models: typeof MODELS.doad;
    getDOADContent(doadNumber: string): Promise<string>;
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
                logger.debug(`Found ${policies.length} relevant policies`);
                
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