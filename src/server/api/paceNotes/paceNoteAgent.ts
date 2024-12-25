import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../utils/s3Client";
import { llmGateway } from "../utils/llmGateway";
import { CONFIG } from "../../config";
import { logger } from "../../logger";
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { PaceNoteRequest, PaceNoteResponse } from "../../../types";

class PaceNoteAgent {
    private readonly promptPath: string;
    private systemPrompt: string = '';

    constructor() {
        this.promptPath = join(process.cwd(), 'src', 'prompts', 'paceNote.md');
        // Initialize by loading the prompt
        this.initializePrompt().catch(error => {
            logger.error('Failed to initialize prompt:', error);
        });
    }

    // Initialize by loading the prompt file (read-only)
    private async initializePrompt(): Promise<void> {
        try {
            logger.debug('Loading system prompt from:', this.promptPath);
            this.systemPrompt = await readFile(this.promptPath, 'utf-8');
            logger.info('System prompt loaded successfully');
        } catch (error) {
            logger.error('Failed to load prompt file:', error);
            throw new Error('Failed to load prompt file');
        }
    }

    // Read competencies from S3 (read-only)
    private async readCompetencies(path: string = 'paceNote/cpl_mcpl.md'): Promise<string> {
        try {
            logger.debug('Reading competencies from S3:', path);
            const response = await s3Client.send(new GetObjectCommand({
                Bucket: CONFIG.s3.bucketName,
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
        // Ensure prompt is loaded
        if (!this.systemPrompt) {
            logger.info('System prompt not loaded, loading now...');
            await this.initializePrompt();
        }

        // Read competencies
        const competencies = await this.readCompetencies();

        // Fill the prompt template
        logger.debug('Preparing prompt with competencies');
        const filledPrompt = this.systemPrompt.replace('{competency_list}', competencies);
        
        logger.debug('Sending request to LLM');
        const response = await llmGateway.query({
            messages: [{ role: 'user', content: request.input }],
            systemPrompt: filledPrompt,
        });

        logger.debug('LLM response received, preparing response');
        return {
            content: response.content,
            timestamp: new Date().toISOString(),
            format: request.format || 'text',
        };
    }
}

// Export singleton instance
export const paceNoteAgent = new PaceNoteAgent(); 