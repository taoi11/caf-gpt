/**
 * PaceNote Service
 * 
 * Handles generation of professional pace notes for CAF members using AI Gateway.
 * Integrates rank-specific competencies and structured feedback templates.
 */

import { createAIGatewayService, type AIGatewayService, type AIGatewayResponse } from './ai-gateway.service.js';
import { readFileAsText } from './r2.util.js';
import basePromptTemplate from './prompts/base.md?raw';
import type { PaceNoteInput, PaceNoteOutput, PaceNoteRank, RankInfo } from './types.js';
import { AVAILABLE_RANKS, VALID_RANKS, AI_GATEWAY_CONFIG, VALIDATION_LIMITS, R2_PATHS } from './constants.js';

export class PaceNoteService {
	private aiService: AIGatewayService;
	private policiesBucket: R2Bucket;
	
	constructor(
		openrouterToken: string,
		aiGatewayBaseURL: string,
		model: string,
		policiesBucket: R2Bucket,
		cfAigToken?: string
	) {
		this.aiService = createAIGatewayService(
			openrouterToken, 
			aiGatewayBaseURL, 
			{
				...AI_GATEWAY_CONFIG,
				model
			},
			cfAigToken
		);
		this.policiesBucket = policiesBucket;
	}

	/**
	 * Generate a pace note based on input parameters
	 */
	async generatePaceNote(input: PaceNoteInput): Promise<PaceNoteOutput> {
		try {
			// Validate input
			this.validateInput(input);
			
			// Build the system prompt and user message
			const systemPrompt = await this.buildSystemPrompt(input.rank, input.competencyFocus);
			const userMessage = this.buildUserMessage(input.observations);

			// Generate the pace note using AI with proper message structure
			const response = await this.aiService.generateFromPrompt(userMessage, systemPrompt);

			return {
				feedback: response.response,
				rank: input.rank,
				generatedAt: new Date(),
				usage: {
					tokens: response.usage?.total_tokens || 0,
					cost: 0 // Simplified - no cost tracking
				}
			};

		} catch (error) {
			console.error('PaceNote generation error:', error);
			
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
	 * Build the system prompt with competencies and examples
	 */
	private async buildSystemPrompt(rank: PaceNoteRank, competencyFocus?: string[]): Promise<string> {
		const competencies = await this.getCompetenciesForRank(rank);
		const examples = await this.getExamples();
		
		// Replace the placeholder variables in the base template
		let systemPrompt = basePromptTemplate
			.replace('{{competency_list}}', competencies)
			.replace('{{examples}}', examples);
		
		// Add specific competency focus if provided
		if (competencyFocus && competencyFocus.length > 0) {
			const focusAreas = competencyFocus.join(', ');
			systemPrompt += `\n\nSPECIFIC COMPETENCY FOCUS: Pay particular attention to ${focusAreas}`;
		}

		return systemPrompt;
	}

	/**
	 * Build the user message with just the observations
	 */
	private buildUserMessage(observations: string): string {
		return observations.trim();
	}

	/**
	 * Get competencies for a specific rank from R2 storage
	 */
	private async getCompetenciesForRank(rank: PaceNoteRank): Promise<string> {
		const filePath = R2_PATHS.COMPETENCIES(rank);
		const competencyContent = await readFileAsText(this.policiesBucket, filePath);
		
		// Return the entire file content as-is
		return competencyContent;
	}

	/**
	 * Get example pace notes from R2 storage
	 */
	private async getExamples(): Promise<string> {
		const exampleContent = await readFileAsText(this.policiesBucket, R2_PATHS.EXAMPLES);
		return exampleContent;
	}

	/**
	 * Get available ranks
	 */
	getAvailableRanks(): RankInfo[] {
		return [...AVAILABLE_RANKS];
	}
	
	/**
	 * Get current AI configuration
	 */
	getAIConfig(): ReturnType<AIGatewayService['getConfig']> {
		return this.aiService.getConfig();
	}
}

/**
 * Factory function to create PaceNoteService instance
 */
export function createPaceNoteService(
	openrouterToken: string,
	aiGatewayBaseURL: string,
	model: string,
	policiesBucket: R2Bucket
): PaceNoteService {
	return new PaceNoteService(openrouterToken, aiGatewayBaseURL, model, policiesBucket);
}
