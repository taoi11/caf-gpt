import { ChatResponse, Message, LLMRequest } from '../../../../../types';
import { DOADHandler, baseDOADImplementation } from '../doadFoo';
import { logger } from '../../../../logger';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { llmGateway } from '../../../utils/llmGateway';
import { s3Client } from '../../../utils/s3Client';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { MODELS } from '../../../../config';

export function createDOADReader(llm = llmGateway): DOADHandler {
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
                // Get policies from finder response
                const policies = history?.[0]?.content.split(',')
                    .map(p => p.trim())
                    .filter(p => baseDOADImplementation.isValidDOADNumber(p)) || [];

                if (policies.length === 0) {
                    return {
                        answer: 'No valid policies to read.',
                        citations: [],
                        followUp: ''
                    };
                }

                logger.info(`Reading DOADs: ${policies.join(', ')}`);
                
                // Process each policy with a small delay
                const responses: string[] = [];
                for (const policy of policies) {
                    const content = await fetchPolicy(policy);
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
                    responses.push(response.content);
                    await new Promise(resolve => setTimeout(resolve, 250)); // Small delay between requests
                }

                // Combine all responses into one
                return {
                    answer: responses.join('\n---\n'),
                    citations: policies,
                    followUp: ''
                };
            } catch (error) {
                logger.error('Error in DOADReader:', error);
                throw error;
            }
        }
    };
} 