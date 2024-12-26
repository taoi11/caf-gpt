import { readFile } from 'fs/promises';
import { join } from 'path';
import { BaseAgent, BaseAgentOptions } from './baseAgent';
import { logger } from '../../logger';
import type { PolicyReference } from '../../../types';

export class FinderAgent extends BaseAgent {
    private finderPrompt: string = '';
    private doadList: string = '';

    constructor(options: BaseAgentOptions = {}) {
        super(options);
        this.initializePrompts().catch(error => {
            logger.error('Failed to initialize finder prompts:', error);
        });
    }

    private async initializePrompts(): Promise<void> {
        try {
            const [finder, doadList] = await Promise.all([
                readFile(join(process.cwd(), 'src', 'prompts', 'policyFoo', 'policyFinder.md'), 'utf-8'),
                readFile(join(process.cwd(), 'src', 'prompts', 'policyFoo', 'DOAD-list-table.md'), 'utf-8')
            ]);

            this.finderPrompt = finder;
            this.doadList = doadList;
            logger.info('Finder prompts loaded successfully');
        } catch (error) {
            logger.error('Failed to load finder prompts:', error);
            throw error;
        }
    }

    public async process(input: string): Promise<PolicyReference[]> {
        const systemPrompt = this.finderPrompt + '\n\n' + this.doadList;
        const response = await this.query([{ role: 'user', content: input }], systemPrompt);
        
        if (response.toLowerCase() === 'none') {
            return [];
        }

        return response.split(',')
            .map(id => id.trim())
            .filter(id => id)
            .map(id => ({ docId: id }));
    }
} 