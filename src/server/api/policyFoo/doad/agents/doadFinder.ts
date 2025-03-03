/**
 * DOAD Finder Agent - Identifies relevant policy documents for user queries.
 * Uses LLM to analyze messages/history and extract applicable DOAD numbers.
 */
import type { LLMRequest, Message, DOADFinder } from '../../../../types';
import { baseDOADImplementation } from '../doad';
import { logger } from '../../../../utils/logger';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { llmGateway } from '../../../../utils/llmGateway';
import { MODELS } from '../../../../utils/config';

/**
 * Creates DOAD Finder agent instance with configured LLM integration
 * @param llm - LLM gateway instance (defaults to shared instance)
 * @returns Configured DOADFinder implementation
 */
export function createDOADFinder(llm = llmGateway): DOADFinder {
    let systemPrompt = '';

    // Load prompts immediately
    Promise.all([
        readFile(join(process.cwd(), 'src/prompts/doad/policyFinder.md'), 'utf-8'),
        readFile(join(process.cwd(), 'src/prompts/doad/DOAD-list-table.md'), 'utf-8')
    ]).then(([prompt, table]) => {
        systemPrompt = prompt.replace('{policies_table}', table);
        logger.debug('Loaded finder prompt with policy table');
    }).catch(error => {
        logger.error('Failed to load finder prompt:', error);
        throw new Error('Failed to initialize DOADFinder');
    });

    return {
        ...baseDOADImplementation,
        
        async handleMessage(message: string, history?: Message[]): Promise<string[]> {
            try {
                // Log initial request for file logging
                logger.debug('Finding relevant DOADs', { message, history });

                // Add timestamp to new message
                const newMessage: Message = {
                    role: 'user',
                    content: message,
                    timestamp: new Date().toISOString()
                };
                
                const request: LLMRequest = {
                    messages: [...(history || []).slice(0, -1), newMessage],
                    systemPrompt,
                    model: MODELS.doad.finder,
                };

                const response = await llm.query(request);
                
                const content = response.content.trim();
                
                if (content.toLowerCase() === 'none') {
                    logger.info('No relevant policies found');
                    return [];
                }

                const policies = content
                    .split(',')
                    .map(p => p.trim())
                    .filter(p => p && p.includes('-'));

                policies.forEach(p => {
                    logger.debug(`Trimmed policy number: "${p}"`);
                });

                logger.info(`Found policies: ${policies.join(', ')}`);
                return policies;
            } catch (error) {
                this.logAgentError('finder', error instanceof Error ? error : new Error(String(error)), {
                    messageLength: message.length,
                    hasHistory: !!history
                });
                throw error;
            }
        }
    };
} 
