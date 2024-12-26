import { llmGateway } from '../utils/llmGateway';
import { logger } from '../../logger';
import { policyStorage } from '../utils/policyStorage';
import type { Message, ChatResponse, PolicyReference, PolicyContent } from '../../../types';

export interface AgentOptions {
    model?: string;
    temperature?: number;
}

class PolicyAgent {
    private readonly llmGateway = llmGateway;
    private finderPrompt: string = '';
    private readerPrompt: string = '';
    private chatPrompt: string = '';

    constructor(private readonly options: AgentOptions = {}) {
        this.initializePrompts().catch(error => {
            logger.error('Failed to initialize prompts:', error);
        });
    }

    private async initializePrompts(): Promise<void> {
        try {
            const { readFile } = await import('fs/promises');
            const { join } = await import('path');
            
            const [finder, reader, chat] = await Promise.all([
                readFile(join(process.cwd(), 'src', 'prompts', 'policyFoo', 'policyFinder.md'), 'utf-8'),
                readFile(join(process.cwd(), 'src', 'prompts', 'policyFoo', 'policyReader.md'), 'utf-8'),
                readFile(join(process.cwd(), 'src', 'prompts', 'policyFoo', 'chatAgent.md'), 'utf-8')
            ]);

            this.finderPrompt = finder;
            this.readerPrompt = reader;
            this.chatPrompt = chat;
            logger.info('All prompts loaded successfully');
        } catch (error) {
            logger.error('Failed to load prompts:', error);
            throw error;
        }
    }

    protected async query(messages: Message[], systemPrompt: string): Promise<string> {
        try {
            const response = await this.llmGateway.query({
                messages,
                systemPrompt,
                model: this.options.model,
                temperature: this.options.temperature
            });
            return response.content;
        } catch (error) {
            logger.error('LLM query failed:', error);
            throw new Error('Failed to process request');
        }
    }

    private async findPolicies(input: string): Promise<PolicyReference[]> {
        const response = await this.query([{ role: 'user', content: input }], this.finderPrompt);
        if (response.toLowerCase() === 'none') return [];

        return response.split(',')
            .map(id => id.trim())
            .filter(id => id)
            .map(id => ({
                docId: id,
                policyGroup: 'doad'
            }));
    }

    private async readPolicyContent(input: string, ref: PolicyReference): Promise<PolicyContent[]> {
        try {
            const doc = await policyStorage.fetchPolicy(ref.docId, ref.policyGroup);
            const systemPrompt = this.readerPrompt.replace('{POLICY_CONTENT}', doc.content);
            const response = await this.query([{ role: 'user', content: input }], systemPrompt);
            
            const results: PolicyContent[] = [];
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
            
            return results;
        } catch (error) {
            logger.error(`Failed to process policy ${ref.docId}:`, error);
            return [];
        }
    }

    private async generateResponse(input: string, policyContent: string): Promise<ChatResponse> {
        const systemPrompt = this.chatPrompt.replace('{policy_extracts}', policyContent);
        const response = await this.query([{ role: 'user', content: input }], systemPrompt);

        const answer = response.match(/<answer>(.*?)<\/answer>/s)?.[1]?.trim() || '';
        const citations = response.match(/<citations>(.*?)<\/citations>/s)?.[1]?.trim().split('\n') || [];
        const followUp = response.match(/<follow_up>(.*?)<\/follow_up>/s)?.[1]?.trim() || '';

        return { answer, citations, followUp };
    }

    public async process(input: string): Promise<ChatResponse> {
        try {
            const refs = await this.findPolicies(input);
            if (!refs.length) {
                return {
                    answer: "I couldn't find any relevant policies for your query.",
                    citations: [],
                    followUp: "Could you provide more details?"
                };
            }

            const contentPromises = refs.map(ref => this.readPolicyContent(input, ref));
            const results = await Promise.all(contentPromises);
            const contents = results.flat();

            if (!contents.length) {
                return {
                    answer: "I found some policies but couldn't extract relevant information.",
                    citations: refs.map(ref => ref.docId),
                    followUp: "Could you be more specific?"
                };
            }

            const policyContent = contents.map(c => 
                `<policy_extract><doc_title>${c.docTitle}</doc_title><section>${c.section}</section><content>${c.content}</content></policy_extract>`
            ).join('\n');

            return await this.generateResponse(input, policyContent);
        } catch (error) {
            logger.error('Error in policy processing:', error);
            throw error;
        }
    }
}

// Export singleton instance
export const policyAgent = new PolicyAgent(); 