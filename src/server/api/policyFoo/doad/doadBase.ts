import type { Message, LLMInteractionData, ChatResponse, DOADImplementation } from '../../../types.js';
import type { DOADLogger } from '../../../node-types.js';
import { logger } from '../../../utils/logger.js';
import { s3Utils } from '../../../utils/s3Client.js';

// Merged interface for implementation
export interface DOADManagerImpl extends DOADImplementation, DOADLogger {}

// Base implementation for DOAD handlers
export const baseDOADImplementation: DOADManagerImpl = {
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