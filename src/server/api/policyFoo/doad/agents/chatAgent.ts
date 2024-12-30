import { LLMRequest, Message } from '../../../../../types';
import { DOADChat, ChatResponse } from '../types';
import { baseDOADImplementation } from '../doadFoo';
import { logger } from '../../../../logger';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { llmGateway } from '../../../utils/llmGateway';
import { MODELS } from '../../../../config';
import { rateLimiter } from '../../../../api/utils/rateLimiter';
import { IncomingMessage } from 'http';

export function createDOADChat(llm = llmGateway): DOADChat {
    let systemPrompt = '';

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

        async handleMessage(
            message: string, 
            userHistory: Message[], 
            policyContext: string,
            req?: IncomingMessage
        ): Promise<ChatResponse> {
            try {
                logger.info('Processing chat response');

                const request: LLMRequest = {
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt.replace('{policy_extracts}', policyContext)
                        },
                        ...userHistory
                    ],
                    model: MODELS.doad.chat,
                    temperature: 0.7
                };

                logger.debug('Chat agent messages:', request.messages);

                const response = await llm.query(request);
                
                if (req) {
                    rateLimiter.trackSuccessfulRequest(req);
                }

                return {
                    answer: response.content,
                    citations: [], // Let frontend handle citation extraction
                    followUp: ''
                };

            } catch (error) {
                logger.error('Error in DOADChat:', error);
                throw error;
            }
        }
    };
} 