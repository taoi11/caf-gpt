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
		policiesBucket: R2Bucket
	) {
		this.aiService = createAIGatewayService(openrouterToken, aiGatewayBaseURL, {
			...AI_GATEWAY_CONFIG,
			model
		});
		this.policiesBucket = policiesBucket;
	}

	/**
	 * Generate a pace note based on input parameters
	 */
	async generatePaceNote(input: PaceNoteInput): Promise<PaceNoteOutput> {
		try {
			// Validate input
			this.validateInput(input);
			
			// Build the prompt with inline competencies
			const prompt = this.buildPrompt(input);

			// Generate the pace note using AI
			const response = await this.aiService.generateFromPrompt(prompt);

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
	 * Build the complete prompt for pace note generation
	 */
	private buildPrompt(input: PaceNoteInput): string {
		const competencies = this.getCompetenciesForRank(input.rank);
		const examples = this.getExamples();
		
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
	 * Get competencies for a specific rank (inline implementation)
	 */
	private getCompetenciesForRank(rank: PaceNoteRank): string[] {
		const competencies = {
			'Cpl': [
				'Leadership and Team Management',
				'Technical and Professional Competence',
				'Communication and Interpersonal Skills',
				'Problem Solving and Decision Making',
				'Adaptability and Learning',
				'Initiative and Accountability'
			],
			'MCpl': [
				'Supervision and Mentoring',
				'Training and Development',
				'Operational Planning',
				'Resource Management',
				'Quality Assurance',
				'Professional Development'
			],
			'Sgt': [
				'Strategic Planning',
				'Personnel Management',
				'Operational Leadership',
				'Risk Management',
				'Performance Management',
				'Change Management'
			],
			'WO': [
				'Organizational Leadership',
				'Strategic Vision',
				'Policy Development',
				'Stakeholder Management',
				'Innovation and Improvement',
				'Professional Excellence'
			]
		};
		
		return competencies[rank] || competencies['Cpl'];
	}

	/**
	 * Get example pace notes (inline implementation)
	 */
	private getExamples(): string {
		return `
Example 1: During the field exercise, the member demonstrated exceptional leadership by coordinating multiple teams under challenging conditions. The member's clear communication and decisive action resulted in successful mission completion ahead of schedule.

Example 2: The member consistently showed initiative by identifying process improvements and implementing solutions that enhanced unit efficiency. This proactive approach contributed to a 15% improvement in operational readiness.

Example 3: When faced with equipment failure, the member quickly adapted and found alternative solutions, ensuring minimal disruption to operations. The member's technical expertise and problem-solving skills were instrumental in maintaining mission success.
		`.trim();
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
