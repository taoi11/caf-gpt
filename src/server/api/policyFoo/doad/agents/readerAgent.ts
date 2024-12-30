import { ChatResponse, Message, LLMRequest } from '../../../../../types';
import { DOADHandler, DOADReader, baseDOADImplementation } from '../doadFoo';
import { logger } from '../../../../logger';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { llmGateway } from '../../../utils/llmGateway';
import { s3Client } from '../../../utils/s3Client';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { MODELS } from '../../../../config';

export function createDOADReader(llm = llmGateway): DOADReader {
    let systemPrompt = '';

    // Load prompt immediately
    readFile(join(process.cwd(), 'src/prompts/doad/policyReader.md'), 'utf-8')
        .then(content => {
            systemPrompt = content;
            logger.debug('Loaded reader prompt');
        })
        .catch(error => {
            logger.error('Failed to load reader prompt:', error);
            throw new Error('Failed to initialize DOADReader');
        });

    async function fetchPolicy(doadNumber: string): Promise<string> {
        try {
            const response = await s3Client.send(new GetObjectCommand({
                Bucket: process.env.S3_BUCKET_NAME,
                Key: baseDOADImplementation.getDOADPath(doadNumber)
            }));
            return await response.Body?.transformToString() || '';
        } catch (error) {
            logger.error(`Failed to fetch DOAD ${doadNumber}:`, error);
            throw new Error(`Failed to fetch DOAD ${doadNumber}`);
        }
    }

    return {
        ...baseDOADImplementation,
        
        async handleMessage(message: string, history?: Message[]): Promise<ChatResponse> {
            try {
                // Get policy content from system message
                const policyContent = history?.[0]?.content;
                if (!policyContent) {
                    logger.warn('Missing policy content');
                    return {
                        answer: '',
                        citations: [],
                        followUp: ''
                    };
                }

                logger.info('Processing policy content');
                logger.debug('Raw policy content:', policyContent);
                
                // Ensure systemPrompt is loaded
                if (!systemPrompt) {
                    logger.info('Loading system prompt');
                    await this.initializePrompts();
                }

                // Create the full system prompt with policy content
                const fullSystemPrompt = systemPrompt.replace(
                    'The policy content is below:\n{POLICY_CONTENT}', 
                    `The policy content is below:\n${policyContent}`
                );

                logger.debug('Full system prompt prepared');
                
                const request: LLMRequest = {
                    messages: [
                        { role: 'system', content: fullSystemPrompt },
                        { role: 'user', content: message }
                    ],
                    model: MODELS.doad.reader,
                    temperature: 0.1
                };

                const response = await llm.query(request);
                
                // Extract DOAD number from response XML
                const docTitleMatch = response.content.match(/<policy_number>(.+?)<\/policy_number>/);
                const doadNumber = docTitleMatch?.[1] || '';

                return {
                    answer: response.content,
                    citations: doadNumber ? [doadNumber] : [],
                    followUp: ''
                };
            } catch (error) {
                logger.error('Error in DOADReader:', error);
                throw error;
            }
        }
    };
} 