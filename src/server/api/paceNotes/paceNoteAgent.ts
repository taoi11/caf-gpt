import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../../utils/s3Client.js";
import { llmGateway } from "../../utils/llmGateway.js";
import { logger } from "../../utils/logger.js";
import { readFile } from 'fs/promises';
import { join } from 'path';
import { MODELS } from '../../utils/config.js';
import type { PaceNoteRequest, PaceNoteResponse } from "../../utils/types.js";

class PaceNoteAgent {
    private readonly promptPath: string;
    private readonly examplesPath: string;
    private systemPrompt: string = '';
    private examples: string = '';

    constructor() {
        this.promptPath = join(process.cwd(), 'src', 'prompts', 'paceNote', 'paceNote.md');
        this.examplesPath = join(process.cwd(), 'src', 'prompts', 'paceNote', 'examples.md');
        // Initialize by loading the prompts
        this.initializePrompts().catch(error => {
            logger.error('Failed to initialize prompts:', error);
        });
    }

    // Initialize by loading the prompt files (read-only)
    private async initializePrompts(): Promise<void> {
        try {
            logger.debug('Loading system prompt from:', this.promptPath);
            logger.debug('Loading examples from:', this.examplesPath);

            // Read both files concurrently
            const [promptContent, examplesContent] = await Promise.all([
                readFile(this.promptPath, 'utf-8'),
                readFile(this.examplesPath, 'utf-8')
            ]);

            this.systemPrompt = promptContent;
            this.examples = examplesContent;

            logger.info('System prompt and examples loaded successfully');
        } catch (error) {
            logger.error('Failed to load prompt files:', error);
            throw new Error('Failed to load prompt files');
        }
    }

    // Read competencies from S3 (read-only)
    private async readCompetencies(path: string = 'paceNote/cpl_mcpl.md'): Promise<string> {
        try {
            logger.debug('Reading competencies from S3:', path);
            const response = await s3Client.send(new GetObjectCommand({
                Bucket: process.env.S3_BUCKET_NAME,
                Key: path,
            }));

            const competencies = await response.Body?.transformToString();
            if (!competencies) {
                logger.error('Empty competencies list received from S3');
                throw new Error('Empty competencies list');
            }
            logger.debug('Competencies loaded successfully');
            return competencies;
        } catch (error) {
            logger.error('Failed to read competencies:', error);
            throw new Error('Failed to read competencies list');
        }
    }

    // Generate pace note
    public async generateNote(request: PaceNoteRequest): Promise<PaceNoteResponse> {
        // Ensure prompts are loaded
        if (!this.systemPrompt || !this.examples) {
            logger.info('Prompts not loaded, loading now...');
            await this.initializePrompts();
        }

        // Read competencies
        const competencies = await this.readCompetencies();

        // Fill the prompt template
        logger.debug('Preparing prompt with competencies and examples');
        const filledPrompt = this.systemPrompt
            .replace('{competency_list}', competencies)
            .replace('{examples}', this.examples);
        
        logger.debug('Sending request to LLM');
        const response = await llmGateway.query({
            messages: [
                { role: 'system', content: filledPrompt },
                { role: 'user', content: request.input }
            ],
            model: MODELS.paceNote,
            temperature: 0.7
        });

        logger.debug('LLM response received, preparing response');
        return {
            content: response.content,
            timestamp: new Date().toISOString(),
            rank: request.rank
        };
    }
}

// Export singleton instance
export const paceNoteAgent = new PaceNoteAgent(); 