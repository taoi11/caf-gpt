import { ChatResponse, Message, LLMRequest } from '../../../../../types';
import { DOADHandler, DOADChat, baseDOADImplementation } from '../doadFoo';
import { logger } from '../../../../logger';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { llmGateway } from '../../../utils/llmGateway';
import { MODELS } from '../../../../config';
import { rateLimiter } from '../../../../api/utils/rateLimiter';
import { IncomingMessage } from 'http';

export function createDOADChat(llm = llmGateway): DOADChat {
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
        
        async handleMessage(message: string, history?: Message[], req?: IncomingMessage): Promise<ChatResponse> {
            try {
                logger.info('Processing chat response');

                // Get policy extracts from previous reader response
                const readerMessage = history?.find(msg => 
                    msg.role === 'assistant' && msg.content.includes('<policy_extract>')
                );
                const policyExtracts = readerMessage?.content || '';

                // Get policies from finder response
                const finderMessage = history?.find(msg => 
                    msg.role === 'assistant' && !msg.content.includes('<policy_extract>')
                );
                const policies = finderMessage?.content.split(',').map(p => p.trim()) || [];

                const request: LLMRequest = {
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt.replace('{policy_extracts}', policyExtracts)
                        },
                        // Include full conversation history except reader response
                        ...(history?.filter(msg => !msg.content.includes('<policy_extract>')) || [])
                    ],
                    model: MODELS.doad.chat,
                    temperature: 0.7
                };

                const response = await llm.query(request);
                
                // Only track if req is provided
                if (req) {
                    rateLimiter.trackSuccessfulRequest(req);
                }

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