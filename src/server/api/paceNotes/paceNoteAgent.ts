/**
 * Core agent for generating standardized CAF performance notes. Handles:
 * - Prompt template management
 * - Competency data loading from S3
 * - LLM interaction orchestration
 * - Response formatting and logging
 * 
 * Maintains read-only access to templates and external data sources following
 * strict data integrity policies.
 */
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../../utils/s3Client";
import { llmGateway } from "../../utils/llmGateway";
import { logger } from "../../utils/logger";
import { readFile } from "fs/promises";
import { join } from "path";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { randomUUID } from "crypto";
import { MODELS } from '../../utils/config';
import type { PaceNoteRequest, PaceNoteResponse, Message } from "../../types";

/**
 * Central coordinator for pace note generation. Manages:
 * - Prompt template loading
 * - Competency data retrieval
 * - LLM interaction orchestration
 * - Response formatting
 */
class PaceNoteAgent {
    /**
     * Initializes a new PaceNoteAgent instance with required paths
     * @param promptPath - Absolute filesystem path to system prompt template
     * @param examplesPath - Absolute filesystem path to example notes
     * @param systemPrompt - Loaded system prompt content (initialized empty)
     * @param examples - Loaded example notes content (initialized empty)
     */
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

    /**
     * Loads prompt templates from filesystem during initialization
     * @throws {Error} If template files cannot be loaded or are empty
     * @returns {Promise<void>} Resolves when templates are loaded successfully
     */
    private async initializePrompts(): Promise<void> {
        try {
            logger.debug('Loading system prompt', { path: this.promptPath });
            logger.debug('Loading examples', { path: this.examplesPath });

            // Read both files concurrently
            const [promptContent, examplesContent] = await Promise.all([
                readFile(this.promptPath, 'utf-8'),
                readFile(this.examplesPath, 'utf-8')
            ]);

            this.systemPrompt = promptContent;
            this.examples = examplesContent;

            logger.logLLMInteraction({
                role: 'system',
                content: this.systemPrompt,
                metadata: {
                    timestamp: new Date().toISOString()
                }
            });

            logger.info('System prompt and examples loaded successfully');
        } catch (error) {
            logger.error('Failed to initialize prompts', {
                error: error instanceof Error ? error.message : String(error)
            });
            throw new Error('Failed to load prompt files');
        }
    }

    /**
     * Retrieves competency data from configured S3 bucket
     * @param {string} [path='paceNote/cpl_mcpl.md'] - S3 object path for competency data
     * @throws {Error} If S3 retrieval fails or returns empty data
     * @returns {Promise<string>} Markdown-formatted competency list
     */
    private async readCompetencies(path: string = 'paceNote/cpl_mcpl.md'): Promise<string> {
        try {
            logger.debug('Reading competencies', { path, source: 'S3' });
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
            logger.error('Failed to read competencies', {
                path,
                error: error instanceof Error ? error.message : String(error)
            });
            throw new Error('Failed to read competencies list');
        }
    }

    /**
     * Generates a formatted pace note from validated user input
     * @param {PaceNoteRequest} request - Validated request containing input text and rank
     * @returns {Promise<PaceNoteResponse>} Structured response with generated content
     * @throws {Error} If any generation step fails (prompt loading, competency fetch, LLM error)
     */
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
        
        // Create message with timestamp
        const userMessage: Message = {
            role: 'user',
            content: request.input,
            timestamp: new Date().toISOString()
        };

        logger.debug('Sending request to LLM');
        const response = await llmGateway.query({
            messages: [userMessage],
            systemPrompt: filledPrompt,
            model: MODELS.paceNote,
            temperature: 0.7
        });

        logger.logLLMInteraction({
            role: 'assistant',
            content: response.content,
            metadata: {
                model: MODELS.paceNote,
                usage: response.usage
            }
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
