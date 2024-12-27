import { ChatResponse, Message, LLMRequest } from '../../../../../types';
import { DOADHandler, baseDOADImplementation } from '../doadFoo';
import { logger } from '../../../../logger';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { llmGateway } from '../../../utils/llmGateway';
import { MODELS } from '../../../../config';

export function createDOADFinder(llm = llmGateway): DOADHandler {
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
        
        async handleMessage(message: string, history?: Message[]): Promise<ChatResponse> {
            try {
                logger.info('Finding relevant DOADs');
                
                const request: LLMRequest = {
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...(history || []),
                        { role: 'user', content: message }
                    ],
                    model: MODELS.doad.finder,
                    temperature: 0.1
                };

                // Just get raw response and extract policy numbers
                const response = await llm.query(request);
                const content = response.content.trim();
                
                // Handle 'none' response
                if (content.toLowerCase() === 'none') {
                    return {
                        answer: 'No relevant policies found.',
                        citations: [],
                        followUp: ''
                    };
                }

                // Extract and validate policy numbers
                const policies = content.split(',')
                    .map(p => p.trim())
                    .filter(p => baseDOADImplementation.isValidDOADNumber(p));

                return {
                    answer: policies.join(', '),
                    citations: policies,
                    followUp: ''
                };
            } catch (error) {
                logger.error('Error in DOADFinder:', error);
                throw error;
            }
        }
    };
} 