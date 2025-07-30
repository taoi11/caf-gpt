/**
 * CAF pace note generator using AI with rank-specific competencies
 */

// Imports
import { createAIGatewayService } from '$lib/server/ai-gateway.service.js';
import type { AIGatewayService, AIGatewayResponse } from '$lib/server/ai-gateway.service.js';
import { readFileAsText } from '$lib/server/r2.util.js';
import basePromptTemplate from './prompts/base.md?raw';
import type { PaceNoteInput, PaceNoteOutput, PaceNoteRank, RankInfo } from './types.js';
import {
	AVAILABLE_RANKS,
	VALID_RANKS,
	AI_GATEWAY_CONFIG,
	VALIDATION_LIMITS,
	R2_PATHS
} from './constants.js';

// Factory function to create PaceNoteService instance
export function createPaceNoteService(
	openrouterToken: string,
	aiGatewayBaseURL: string,
	model: string,
	policiesBucket: R2Bucket
): PaceNoteService {
	return new PaceNoteService(openrouterToken, aiGatewayBaseURL, model, policiesBucket);
}

// Main Service Class
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

	// Input validation
	private validateInput(input: PaceNoteInput): void {
		if (!input.rank || !VALID_RANKS.includes(input.rank)) {
			throw {
				code: 'INVALID_RANK',
				message: `Rank must be one of: ${VALID_RANKS.join(', ')}`
			};
		}

		if (
			!input.observations ||
			input.observations.trim().length < VALIDATION_LIMITS.MIN_OBSERVATIONS_LENGTH
		) {
			throw {
				code: 'INVALID_OBSERVATIONS',
				message: `Observations must be at least ${VALIDATION_LIMITS.MIN_OBSERVATIONS_LENGTH} characters long`
			};
		}

		if (input.observations.length > VALIDATION_LIMITS.MAX_OBSERVATIONS_LENGTH) {
			throw {
				code: 'OBSERVATIONS_TOO_LONG',
				message: `Observations must be less than ${VALIDATION_LIMITS.MAX_OBSERVATIONS_LENGTH} characters`
			};
		}
	}

	// Prompt building
	private async buildSystemPrompt(rank: PaceNoteRank, competencyFocus?: string[]): Promise<string> {
		const competencies = await this.getCompetenciesForRank(rank);
		const examples = await this.getExamples();

		let systemPrompt = basePromptTemplate
			.replace('{{competency_list}}', competencies)
			.replace('{{examples}}', examples);

		if (competencyFocus && competencyFocus.length > 0) {
			const focusAreas = competencyFocus.join(', ');
			systemPrompt += `\n\nSPECIFIC COMPETENCY FOCUS: Pay particular attention to ${focusAreas}`;
		}

		return systemPrompt;
	}

	private buildUserMessage(observations: string): string {
		return observations.trim();
	}

	// R2 operations
	private async getCompetenciesForRank(rank: PaceNoteRank): Promise<string> {
		const filePath = R2_PATHS.COMPETENCIES(rank);
		const competencyContent = await readFileAsText(this.policiesBucket, filePath);
		return competencyContent;
	}

	private async getExamples(): Promise<string> {
		const exampleContent = await readFileAsText(this.policiesBucket, R2_PATHS.EXAMPLES);
		return exampleContent;
	}

	// Main generation
	async generatePaceNote(input: PaceNoteInput): Promise<PaceNoteOutput> {
		try {
			this.validateInput(input);
			const systemPrompt = await this.buildSystemPrompt(input.rank, input.competencyFocus);
			const userMessage = this.buildUserMessage(input.observations);
			const response = await this.aiService.generateFromPrompt(userMessage, systemPrompt);
			return {
				feedback: response.response,
				rank: input.rank,
				generatedAt: new Date(),
				usage: {
					tokens: response.usage?.total_tokens || 0,
					cost: 0
				}
			};
		} catch (error) {
			console.error('PaceNote generation error:', error);
			if (error && typeof error === 'object' && 'code' in error) {
				throw error;
			}
			throw {
				code: 'PACENOTE_ERROR',
				message: 'Failed to generate pace note',
				details: { originalError: error }
			};
		}
	}

	// Getters
	getAvailableRanks(): RankInfo[] {
		return [...AVAILABLE_RANKS];
	}

	getAIConfig(): ReturnType<AIGatewayService['getConfig']> {
		return this.aiService.getConfig();
	}
}
