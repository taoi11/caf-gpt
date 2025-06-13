/**
 * PaceNote Service
 * 
 * Handles generation of professional pace notes for CAF members using Workers AI.
 * Integrates rank-specific competencies and structured feedback templates.
 */

import { createWorkersAIService, type WorkersAIService, type WorkersAIResponse } from './workers-ai.service.js';
import { readFileAsText } from './r2.util.js';
import basePromptTemplate from './prompts/base.md?raw';
import type { PaceNoteInput, PaceNoteOutput, PaceNoteRank, RankInfo } from './types.js';
import { AVAILABLE_RANKS, VALID_RANKS, AI_CONFIG, VALIDATION_LIMITS, R2_PATHS } from './constants.js';

export class PaceNoteService {
	private aiService: WorkersAIService;
	private policiesBucket: R2Bucket;
	
	constructor(ai: Ai, policiesBucket: R2Bucket) {
		this.aiService = createWorkersAIService(ai, AI_CONFIG);
		this.policiesBucket = policiesBucket;
	}

	/**
	 * Generate a pace note based on input parameters
	 */
	async generatePaceNote(input: PaceNoteInput): Promise<PaceNoteOutput> {
		try {
			// Validate input
			this.validateInput(input);
			
			// Load competencies and examples from R2
			const [competencies, examples] = await Promise.all([
				this.loadCompetenciesForRank(input.rank),
				this.loadExamples()
			]);

			// Build the prompt
			const prompt = this.buildPrompt(input, competencies, examples);

			// Generate the pace note using AI
			const response = await this.aiService.generateFromPrompt(prompt);

			return {
				feedback: response.response,
				rank: input.rank,
				generatedAt: new Date(),
				usage: {
					tokens: response.usage?.total_tokens || 0,
					cost: response.cost || 0
				}
			};

		} catch (error) {
			// Re-throw with context
			if (error && typeof error === 'object' && 'code' in error) {
				throw error; // WorkersAI error, pass through
			}
			
			throw {
				code: 'PACENOTE_ERROR',
				message: 'Failed to generate pace note',
				details: { originalError: error }
			};
		}
	}

	/**
	 * Validate pace note input
	 */
	private validateInput(input: PaceNoteInput): void {
		if (!input.rank || !VALID_RANKS.includes(input.rank)) {
			throw {
				code: 'INVALID_RANK',
				message: `Rank must be one of: ${VALID_RANKS.join(', ')}`
			};
		}

		if (!input.observations || input.observations.trim().length < VALIDATION_LIMITS.MIN_OBSERVATIONS_LENGTH) {
			throw {
				code: 'INVALID_OBSERVATIONS',
				message: `Observations must be at least ${VALIDATION_LIMITS.MIN_OBSERVATIONS_LENGTH} characters long`
			};
		}

		// Check for reasonable length limits
		if (input.observations.length > VALIDATION_LIMITS.MAX_OBSERVATIONS_LENGTH) {
			throw {
				code: 'OBSERVATIONS_TOO_LONG',
				message: `Observations must be less than ${VALIDATION_LIMITS.MAX_OBSERVATIONS_LENGTH} characters`
			};
		}
	}

	/**
	 * Build the complete prompt for pace note generation
	 */
	private buildPrompt(input: PaceNoteInput, competencies: string[], examples: string): string {
		const competencyList = competencies
			.map((comp: string, index: number) => `${index + 1}. ${comp}`)
			.join('\n');
		
		// Replace the placeholder variables in the template
		let prompt = basePromptTemplate
			.replace('{{competency_list}}', competencyList)
			.replace('{{examples}}', examples);
		
		// Add context specific to this pace note
		prompt += `\n\nRANK: ${input.rank}\n\n`;
		prompt += `OBSERVATIONS:\n${input.observations.trim()}`;

		// Add specific competency focus if provided
		if (input.competencyFocus && input.competencyFocus.length > 0) {
			const focusAreas = input.competencyFocus.join(', ');
			prompt += `\n\nSPECIFIC COMPETENCY FOCUS: Pay particular attention to ${focusAreas}`;
		}

		return prompt;
	}

	/**
	 * Get available ranks
	 */
	getAvailableRanks(): RankInfo[] {
		return [...AVAILABLE_RANKS];
	}

	/**
	 * Load examples from R2 storage
	 */
	async loadExamples(): Promise<string> {
		const content = await readFileAsText(this.policiesBucket, R2_PATHS.EXAMPLES);
		return content.trim();
	}

	/**
	 * Load competencies for a specific rank from R2 storage
	 */
	async loadCompetenciesForRank(rank: PaceNoteRank): Promise<string[]> {
		const filePath = R2_PATHS.COMPETENCIES(rank);
		const content = await readFileAsText(this.policiesBucket, filePath);
		
		// Parse the markdown content to extract competencies
		const lines = content.split('\n')
			.map(line => line.trim())
			.filter(line => line.startsWith('-') || line.startsWith('*'))
			.map(line => line.substring(1).trim())
			.filter(line => line.length > 0);
		
		if (lines.length === 0) {
			throw new Error(`No competencies found in ${filePath}`);
		}
		
		return lines;
	}
	
	/**
	 * Update AI service configuration
	 */
	updateAIConfig(config: Parameters<WorkersAIService['updateConfig']>[0]): void {
		this.aiService.updateConfig(config);
	}

	/**
	 * Get current AI configuration
	 */
	getAIConfig(): ReturnType<WorkersAIService['getConfig']> {
		return this.aiService.getConfig();
	}
}

/**
 * Factory function to create PaceNoteService instance
 */
export function createPaceNoteService(ai: Ai, policiesBucket: R2Bucket): PaceNoteService {
	return new PaceNoteService(ai, policiesBucket);
}
