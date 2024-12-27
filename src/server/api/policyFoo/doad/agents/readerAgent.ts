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
                // Get policy number from history
                const policyNumber = history?.[1]?.content;
                if (!policyNumber || !baseDOADImplementation.isValidDOADNumber(policyNumber)) {
                    logger.warn('Invalid policy number');
                    return {
                        answer: '',
                        citations: [],
                        followUp: ''
                    };
                }

                logger.info(`Reading DOAD: ${policyNumber}`);
                
                // Fetch and process single policy
                const content = await fetchPolicy(policyNumber);
                logger.debug(`Fetched content for ${policyNumber}`);
                
                const request: LLMRequest = {
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt.replace('{POLICY_CONTENT}', content)
                        },
                        { role: 'user', content: message }
                    ],
                    model: MODELS.doad.reader,
                    temperature: 0.1
                };

                const response = await llm.query(request);
                return {
                    answer: response.content,
                    citations: [policyNumber],
                    followUp: ''
                };
            } catch (error) {
                logger.error('Error in DOADReader:', error);
                throw error;
            }
        }
    };
} 