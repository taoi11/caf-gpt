import { LLMRequest, Message } from '../../../../../types';
import { DOADFinder } from '../types';
import { baseDOADImplementation } from '../doadFoo';
import { logger } from '../../../utils/logger';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { llmGateway } from '../../../utils/llmGateway';
import { MODELS } from '../../../utils/config';

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
                
                const request: LLMRequest = {
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...(history || []).slice(0, -1),
                        { role: 'user', content: message }
                    ],
                    model: MODELS.doad.finder,
                    temperature: 0.1
                };

                // Log request messages for file logging
                logger.debug('Finder agent request messages:', request.messages);

                const response = await llm.query(request);
                
                // Log LLM response for file logging
                logger.debug('Finder agent LLM response received:', response);
                
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
                logger.error('Error in DOADFinder:', error);
                throw error;
            }
        }
    };
} 