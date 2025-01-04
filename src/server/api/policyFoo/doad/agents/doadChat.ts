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

                // Add timestamp to new message
                const newMessage: Message = {
                    role: 'user',
                    content: message,
                    timestamp: new Date().toISOString()
                };

                // Combine history with new message
                const messages = userHistory.length > 0 ? userHistory : [];
                if (!messages.some(m => m.content === message)) {
                    messages.push(newMessage);
                }

                const request: LLMRequest = {
                    messages,
                    systemPrompt: systemPrompt.replace('{policies_content}', policyContext),
                    model: MODELS.doad.chat
                };

                logger.debug('Chat agent request:', {
                    messageCount: messages.length,
                    hasSystemPrompt: !!request.systemPrompt,
                    policyContextLength: policyContext.length
                });

                const response = await llm.query(request);
                
                if (req) {
                    rateLimiter.trackSuccessfulRequest(req);
                }

                return {
                    answer: response.content,
                    citations: [],
                    followUp: ''
                };

            } catch (error) {
                this.logAgentError('chat', error instanceof Error ? error : new Error(String(error)), {
                    messageLength: message.length,
                    historyLength: userHistory.length,
                    policyContextLength: policyContext.length
                });
                throw error;
            }
        }
    };
} 