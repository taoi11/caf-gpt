import { ChatResponse, Message, LLMRequest } from '../../../../../types';
import { DOADHandler, DOADFinder, baseDOADImplementation } from '../doadFoo';
import { logger } from '../../../../logger';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { llmGateway } from '../../../utils/llmGateway';
import { MODELS } from '../../../../config';

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
        
        async handleMessage(message: string): Promise<string[]> {
            try {
                logger.info('Finding relevant DOADs');
                
                const request: LLMRequest = {
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: message }
                    ],
                    model: MODELS.doad.finder,
                    temperature: 0.1
                };

                const response = await llm.query(request);
                
                // Clean up response - replace newlines with commas and handle multiple spaces
                const content = response.content
                    .replace(/\n/g, ',')  // Replace newlines with commas
                    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
                    .trim();
                
                if (content.toLowerCase() === 'none') {
                    logger.info('No relevant policies found');
                    return [];
                }

                // Split by comma and clean up
                const policies = content
                    .split(',')
                    .map(p => p.trim())
                    .filter(p => p && p.includes('-')); // Basic validation

                logger.info(`Found policies: ${policies.join(', ')}`);
                return policies;
            } catch (error) {
                logger.error('Error in DOADFinder:', error);
                throw error;
            }
        }
    };
} 