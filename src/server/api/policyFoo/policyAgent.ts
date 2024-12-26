import { BaseAgent, BaseAgentOptions } from './baseAgent';
import { FinderAgent } from './finderAgent';
import { ReaderAgent } from './readerAgent';
import { ChatAgent } from './chatAgent';
import { logger } from '../../logger';
import { IncomingMessage } from 'http';
import type { ChatResponse } from '../../../types';

export class PolicyAgent extends BaseAgent {
    private readonly finderAgent: FinderAgent;
    private readonly readerAgent: ReaderAgent;
    private readonly chatAgent: ChatAgent;

    constructor(options: BaseAgentOptions = {}) {
        super(options);
        this.finderAgent = new FinderAgent(options);
        this.readerAgent = new ReaderAgent(options);
        this.chatAgent = new ChatAgent(options);
    }

    public async process(input: string, req: IncomingMessage): Promise<ChatResponse> {
        if (!await this.checkRateLimit(req)) {
            throw new Error('Rate limit exceeded');
        }

        // Find relevant policies
        const refs = await this.finderAgent.process(input);
        if (refs.length === 0) {
            return {
                answer: "I couldn't find any relevant policies for your query.",
                citations: [],
                followUp: "Could you provide more details about what you're looking for?"
            };
        }

        // Read policy contents
        const contents = await this.readerAgent.process(refs, input);
        if (contents.length === 0) {
            return {
                answer: "I found some policies but couldn't extract relevant information.",
                citations: refs.map(ref => ref.docId),
                followUp: "Could you be more specific about what you're looking for in these policies?"
            };
        }

        // Generate response
        return this.chatAgent.process(contents, input);
    }
} 