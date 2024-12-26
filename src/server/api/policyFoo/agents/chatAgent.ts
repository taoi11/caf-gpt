import { readFile } from 'fs/promises';
import { join } from 'path';
import { BaseAgent, AgentOptions } from '../baseAgent';
import { logger } from '../../../logger';
import type { ChatResponse } from '../../../../types';

export class ChatAgent extends BaseAgent {
    private chatPrompt: string = '';

    constructor(options: AgentOptions = {}) {
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

    public async process(input: string, context?: string): Promise<ChatResponse> {
        if (!context) {
            throw new Error('ChatAgent requires policy content context');
        }
        const systemPrompt = this.chatPrompt.replace('{policy_extracts}', context);
        const response = await this.query([{ role: 'user', content: input }], systemPrompt);

        // Parse XML response
        const answer = response.match(/<answer>(.*?)<\/answer>/s)?.[1]?.trim() || '';
        const citations = response.match(/<citations>(.*?)<\/citations>/s)?.[1]?.trim().split('\n') || [];
        const followUp = response.match(/<follow_up>(.*?)<\/follow_up>/s)?.[1]?.trim() || '';

        return { answer, citations, followUp };
    }
} 