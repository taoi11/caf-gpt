import { readFile } from 'fs/promises';
import { join } from 'path';
import { BaseAgent, BaseAgentOptions } from './baseAgent';
import { logger } from '../../logger';
import { s3Client } from '../utils/s3Client';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import type { PolicyReference, PolicyContent } from '../../../types';

export class ReaderAgent extends BaseAgent {
    private readerPrompt: string = '';

    constructor(options: BaseAgentOptions = {}) {
        super(options);
        this.initializePrompts().catch(error => {
            logger.error('Failed to initialize reader prompt:', error);
        });
    }

    private async initializePrompts(): Promise<void> {
        try {
            this.readerPrompt = await readFile(
                join(process.cwd(), 'src', 'prompts', 'policyFoo', 'policyReader.md'),
                'utf-8'
            );
            logger.info('Reader prompt loaded successfully');
        } catch (error) {
            logger.error('Failed to load reader prompt:', error);
            throw error;
        }
    }

    private async fetchPolicyContent(ref: PolicyReference): Promise<string> {
        try {
            const response = await s3Client.send(new GetObjectCommand({
                Bucket: process.env.S3_BUCKET_NAME,
                Key: `policies/${ref.docId}.md`,
            }));

            const content = await response.Body?.transformToString();
            if (!content) {
                throw new Error(`Empty content for policy ${ref.docId}`);
            }

            return content;
        } catch (error) {
            logger.error(`Failed to fetch policy ${ref.docId}:`, error);
            throw error;
        }
    }

    public async process(refs: PolicyReference[], query: string): Promise<PolicyContent[]> {
        const results: PolicyContent[] = [];

        for (const ref of refs) {
            try {
                const content = await this.fetchPolicyContent(ref);
                const systemPrompt = this.readerPrompt.replace('{POLICY_CONTENT}', content);
                
                const response = await this.query([{ role: 'user', content: query }], systemPrompt);
                
                // Parse XML response
                const matches = response.matchAll(/<policy_extract>(.*?)<\/policy_extract>/gs);
                for (const match of matches) {
                    const extract = match[1];
                    const docTitle = extract.match(/<doc_title>(.*?)<\/doc_title>/s)?.[1]?.trim() || ref.docId;
                    const section = extract.match(/<section>(.*?)<\/section>/s)?.[1]?.trim() || '';
                    const content = extract.match(/<content>(.*?)<\/content>/s)?.[1]?.trim() || '';

                    if (content !== 'Not relevant') {
                        results.push({ docTitle, section, content });
                    }
                }
            } catch (error) {
                logger.error(`Failed to process policy ${ref.docId}:`, error);
                // Continue with other policies even if one fails
                continue;
            }
        }

        return results;
    }
} 