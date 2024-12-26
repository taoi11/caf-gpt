import { readFile } from 'fs/promises';
import { join } from 'path';
import { BaseAgent, BaseAgentOptions } from './baseAgent';
import { logger } from '../../logger';
import type { PolicyContent, ChatResponse } from '../../../types';

export class ChatAgent extends BaseAgent {
    private chatPrompt: string = '';

    constructor(options: BaseAgentOptions = {}) {
        super(options);
        this.initializePrompts().catch(error => {
            logger.error('Failed to initialize chat prompt:', error);
        });
    }

    private async initializePrompts(): Promise<void> {
        try {
            this.chatPrompt = await readFile(
                join(process.cwd(), 'src', 'prompts', 'policyFoo', 'chatAgent.md'),
                'utf-8'
            );
            logger.info('Chat prompt loaded successfully');
        } catch (error) {
            logger.error('Failed to load chat prompt:', error);
            throw error;
        }
    }

    public async process(contents: PolicyContent[], query: string): Promise<ChatResponse> {
        const policyExtracts = contents.map(content => `
            <policy_extract>
                <doc_title>${content.docTitle}</doc_title>
                <section>${content.section}</section>
                <content>${content.content}</content>
            </policy_extract>
        `).join('\n');

        const systemPrompt = this.chatPrompt.replace('{policy_extracts}', policyExtracts);
        const response = await this.query([{ role: 'user', content: query }], systemPrompt);

        // Parse XML response
        const answer = response.match(/<answer>(.*?)<\/answer>/s)?.[1]?.trim() || '';
        const citations = response.match(/<citations>(.*?)<\/citations>/s)?.[1]?.trim().split('\n') || [];
        const followUp = response.match(/<follow_up>(.*?)<\/follow_up>/s)?.[1]?.trim() || '';

        return { answer, citations, followUp };
    }
} 