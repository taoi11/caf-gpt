import { LLMRequest, Message } from '../../../../../types';
import { DOADReader, AgentResponse } from '../types';
import { baseDOADImplementation } from '../doadFoo';
import { logger } from '../../../../logger';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { llmGateway } from '../../../utils/llmGateway';
import { MODELS } from '../../../../config';

export function createDOADReader(llm = llmGateway): DOADReader {
    let systemPrompt = '';

    async function initializePrompts() {
        systemPrompt = await readFile(join(process.cwd(), 'src/prompts/doad/policyReader.md'), 'utf-8');
        logger.debug('Loaded reader prompt');
    }

    initializePrompts().catch(error => {
        logger.error('Failed to load reader prompt:', error);
        throw new Error('Failed to initialize DOADReader');
    });

    return {
        ...baseDOADImplementation,
        
        async handleMessage(message: string, policyContent: string, history?: Message[]): Promise<AgentResponse> {
            try {
                logger.info('Processing policy content');
                
                const fullSystemPrompt = systemPrompt.replace(
                    '{POLICY_CONTENT}', 
                    policyContent
                );

                const request: LLMRequest = {
                    messages: [
                        { role: 'system', content: fullSystemPrompt },
                        ...(history || []).slice(0, -1),  // Include all but last message
                        { role: 'user', content: message }  // Add current message
                    ],
                    model: MODELS.doad.reader,
                    temperature: 0.1
                };

                const response = await llm.query(request);
                
                const docTitleMatch = response.content.match(/<policy_number>(.+?)<\/policy_number>/);
                const doadNumber = docTitleMatch?.[1] || '';

                return {
                    content: response.content,
                    metadata: {
                        doadNumber: doadNumber
                    }
                };
            } catch (error) {
                logger.error('Error in DOADReader:', error);
                throw error;
            }
        }
    };
} 