/**
 * PaceNote Service
 * 
 * Handles generation of professional pace notes for CAF members using Workers AI.
 * Integrates rank-specific competencies and structured feedback templates.
 */

import { createWorkersAIService, type WorkersAIService, type WorkersAIMessage } from './workers-ai.service.js';
import type { WorkersAIResponse } from '../types/index.js';

export interface PaceNoteInput {
	rank: 'Cpl' | 'MCpl' | 'Sgt' | 'WO';
	memberDetails: string;
	observations: string;
	competencyFocus?: string[];
}

export interface PaceNoteOutput {
	feedback: string;
	rank: string;
	generatedAt: Date;
	usage: {
		tokens: number;
		cost: number;
	};
}

/**
 * Base prompt template for pace note generation
 */
const BASE_PROMPT_TEMPLATE = `You are a CAF (Canadian Armed Forces) supervisor writing a professional pace note for a {RANK}.

INSTRUCTIONS:
- Write a professional, constructive feedback note in two paragraphs
- First paragraph: Describe the events and observations objectively
- Second paragraph: Focus on outcomes, impact, and specific competencies demonstrated
- Use appropriate CAF terminology and maintain professional tone
- Be specific and actionable in your feedback
- Focus on the competencies relevant to the {RANK} rank level

RANK-SPECIFIC COMPETENCIES FOR {RANK}:
{COMPETENCIES}

MEMBER DETAILS:
{MEMBER_DETAILS}

OBSERVATIONS:
{OBSERVATIONS}

Generate a professional pace note based on the above information:`;

/**
 * Rank-specific competency frameworks
 */
const RANK_COMPETENCIES = {
	'Cpl': [
		'Technical proficiency in trade skills',
		'Following orders and procedures',
		'Basic leadership in small team settings',
		'Personal responsibility and accountability',
		'Professional development and learning',
		'Safety awareness and compliance'
	],
	'MCpl': [
		'Team leadership and mentoring',
		'Technical expertise and problem-solving',
		'Training and developing junior members',
		'Resource management and planning',
		'Communication and coordination',
		'Initiative and decision-making in routine situations'
	],
	'Sgt': [
		'Supervision and management of personnel',
		'Strategic thinking and planning',
		'Advanced technical knowledge and instruction',
		'Performance management and development',
		'Inter-departmental coordination',
		'Leadership in complex or challenging situations'
	],
	'WO': [
		'Senior leadership and organizational impact',
		'Policy development and implementation',
		'Mentoring and developing leaders',
		'Strategic planning and resource allocation',
		'Representing the organization externally',
		'Leading organizational change and improvement'
	]
};

export class PaceNoteService {
	private aiService: WorkersAIService;

	constructor(ai: Ai) {
		this.aiService = createWorkersAIService(ai, {
			model: '@cf/meta/llama-3.1-8b-instruct',
			maxTokens: 800,
			temperature: 0.7,
			topP: 0.9
		});
	}

	/**
	 * Generate a pace note based on input parameters
	 */
	async generatePaceNote(input: PaceNoteInput): Promise<PaceNoteOutput> {
		try {
			// Validate input
			this.validateInput(input);

			// Build the prompt
			const prompt = this.buildPrompt(input);

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
		if (!input.rank || !['Cpl', 'MCpl', 'Sgt', 'WO'].includes(input.rank)) {
			throw {
				code: 'INVALID_RANK',
				message: 'Rank must be one of: Cpl, MCpl, Sgt, WO'
			};
		}

		if (!input.memberDetails || input.memberDetails.trim().length < 10) {
			throw {
				code: 'INVALID_MEMBER_DETAILS',
				message: 'Member details must be at least 10 characters long'
			};
		}

		if (!input.observations || input.observations.trim().length < 20) {
			throw {
				code: 'INVALID_OBSERVATIONS',
				message: 'Observations must be at least 20 characters long'
			};
		}

		// Check for reasonable length limits
		if (input.memberDetails.length > 1000) {
			throw {
				code: 'MEMBER_DETAILS_TOO_LONG',
				message: 'Member details must be less than 1000 characters'
			};
		}

		if (input.observations.length > 2000) {
			throw {
				code: 'OBSERVATIONS_TOO_LONG',
				message: 'Observations must be less than 2000 characters'
			};
		}
	}

	/**
	 * Build the complete prompt for pace note generation
	 */
	private buildPrompt(input: PaceNoteInput): string {
		const competencies = RANK_COMPETENCIES[input.rank];
		const competencyList = competencies
			.map((comp, index) => `${index + 1}. ${comp}`)
			.join('\n');

		let prompt = BASE_PROMPT_TEMPLATE
			.replace(/\{RANK\}/g, input.rank)
			.replace('{COMPETENCIES}', competencyList)
			.replace('{MEMBER_DETAILS}', input.memberDetails.trim())
			.replace('{OBSERVATIONS}', input.observations.trim());

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
	getAvailableRanks(): Array<{ value: string; label: string; description: string }> {
		return [
			{
				value: 'Cpl',
				label: 'Corporal (Cpl)',
				description: 'Junior NCO - Team leadership and technical proficiency'
			},
			{
				value: 'MCpl',
				label: 'Master Corporal (MCpl)', 
				description: 'Experienced NCO - Team mentoring and training'
			},
			{
				value: 'Sgt',
				label: 'Sergeant (Sgt)',
				description: 'Senior NCO - Supervision and management'
			},
			{
				value: 'WO',
				label: 'Warrant Officer (WO)',
				description: 'Senior leader - Strategic planning and organizational impact'
			}
		];
	}

	/**
	 * Get competencies for a specific rank
	 */
	getCompetenciesForRank(rank: keyof typeof RANK_COMPETENCIES): string[] {
		return [...RANK_COMPETENCIES[rank]];
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
export function createPaceNoteService(ai: Ai): PaceNoteService {
	return new PaceNoteService(ai);
}
