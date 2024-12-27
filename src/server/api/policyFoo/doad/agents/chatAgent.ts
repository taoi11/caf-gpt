import { ChatResponse, Message, LLMRequest } from '../../../../../types';
import { DOADHandler, baseDOADImplementation } from '../doadFoo';
import { logger } from '../../../../logger';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { llmGateway } from '../../../utils/llmGateway';
import { MODELS } from '../../../../config';

export function createDOADChat(llm = llmGateway): DOADHandler {
    let systemPrompt = '';

    // Load prompt immediately
    readFile(join(process.cwd(), 'src/prompts/doad/chatAgent.md'), 'utf-8')
        .then(content => {
            systemPrompt = content;
            logger.debug('Loaded chat prompt');
        })
        .catch(error => {
            logger.error('Failed to load chat prompt:', error);
            throw new Error('Failed to initialize DOADChat');
        });

    return {
        ...baseDOADImplementation,
        
        async handleMessage(message: string, history?: Message[]): Promise<ChatResponse> {
            try {
                logger.info('Processing chat response');

                // Get policy extracts from previous reader response
                const policyExtracts = history?.[history.length - 1]?.content || '';
                const policies = history?.[0]?.content.split(',').map(p => p.trim()) || [];

                const request: LLMRequest = {
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt.replace('{policy_extracts}', policyExtracts)
                        },
                        ...(history?.slice(0, -1) || []),
                        { role: 'user', content: message }
                    ],
                    model: MODELS.doad.chat,
                    temperature: 0.7
                };

                const response = await llm.query(request);

                // Let frontend handle XML parsing
                return {
                    answer: response.content,
                    citations: policies,
                    followUp: ''
                };

            } catch (error) {
                logger.error('Error in DOADChat:', error);
                throw error;
            }
        }
    };
} 