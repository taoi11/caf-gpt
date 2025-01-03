import { LLMRequest, Message } from '../../../../utils/types.js';
import { DOADChat, ChatResponse } from '../types.js';
import { baseDOADImplementation } from '../doad.js';
import { logger } from '../../../../utils/logger.js';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { llmGateway } from '../../../../utils/llmGateway.js';
import { MODELS } from '../../../../utils/config.js';
import { rateLimiter } from '../../../../utils/rateLimiter.js';
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
                            content: systemPrompt.replace('{policies_content}', policyContext)
                        },
                        ...userHistory
                    ],
                    model: MODELS.doad.chat,
                    temperature: 0.7
                };

                logger.debug('Chat agent request messages:', request.messages);

                const response = await llm.query(request);
                
                logger.debug('LLM response received:', {
                    content: response.content,
                    model: response.model,
                    usage: response.usage
                });
                
                if (req) {
                    rateLimiter.trackSuccessfulRequest(req);
                }

                return {
                    answer: response.content,
                    citations: [],
                    followUp: ''
                };

            } catch (error) {
                logger.error('Error in DOADChat:', error);
                throw error;
            }
        }
    };
} 