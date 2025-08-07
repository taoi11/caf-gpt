import { BasePolicyDatabaseService, formatMetadataForLLM } from '../../../core/db/service.js';
import type { DOADChunk, DOADMetadata } from '../types.js';

/**
 * DOAD Database Service - extends common patterns with DOAD-specific logic
 */
export class DOADDatabaseService extends BasePolicyDatabaseService {
	private readonly TABLE_NAME = 'doad';
	private readonly IDENTIFIER_COLUMN = 'doad_number';

	/**
	 * Fetch all chunks for specified DOAD numbers with optimized query
	 */
	async getDOADChunksByNumbers(doadNumbers: string[]): Promise<DOADChunk[]> {
		if (doadNumbers.length === 0) return [];

		const placeholders = doadNumbers.map((_, i) => `$${i + 1}`).join(', ');

		const sql = `
			SELECT id, doad_number, text_chunk, created_at, metadata
			FROM ${this.TABLE_NAME} 
			WHERE ${this.IDENTIFIER_COLUMN} IN (${placeholders})
			ORDER BY ${this.IDENTIFIER_COLUMN}, created_at
		`;

		const result = await this.executeQuery(sql, doadNumbers);

		return result.data.map((row) => ({
			id: row.id,
			textChunk: row.text_chunk,
			metadata: row.metadata || {},
			createdAt: row.created_at?.toISOString() || new Date().toISOString(),
			doadNumber: row.doad_number || ''
		}));
	}

	/**
	 * Fetch metadata only for specified DOAD numbers (optimized for LLM selection)
	 */
	async getDOADMetadataByNumbers(doadNumbers: string[]): Promise<DOADMetadata[]> {
		const metadata = await this.getMetadataByIdentifiers(
			this.TABLE_NAME,
			doadNumbers,
			this.IDENTIFIER_COLUMN
		);

		// Create a map from DOAD number to metadata item for correct assignment
		const metadataMap = new Map<string, typeof metadata[number]>();
		for (const item of metadata) {
			const doadKey = String(item[this.IDENTIFIER_COLUMN] ?? item.doad_number ?? '');
			metadataMap.set(doadKey, item);
		}

		return doadNumbers.map((doadNumber) => {
			const item = metadataMap.get(String(doadNumber));
			return item
				? {
						id: item.id,
						metadata: enhanceMetadataForLLM(item.metadata, doadNumber)
				  }
				: {
						id: '',
						metadata: enhanceMetadataForLLM({}, doadNumber)
				  };
		});
	}

	/**
	 * Fetch specific chunks by IDs (used after metadata selection)
	 */
	async getDOADChunksByIds(chunkIds: string[]): Promise<DOADChunk[]> {
		const chunks = await this.getChunksByIds(this.TABLE_NAME, chunkIds);

		return chunks.map((chunk) => ({
			...chunk,
			doadNumber: chunk.metadata?.doad_number || ''
		})) as DOADChunk[];
	}

	/**
	 * Get all available DOAD numbers
	 */
	async getAvailableDOADNumbers(): Promise<string[]> {
		return this.getAvailableIdentifiers(
			this.TABLE_NAME,
			this.IDENTIFIER_COLUMN,
			`CASE WHEN ${this.IDENTIFIER_COLUMN} ~ '^[0-9]+' THEN LPAD(SPLIT_PART(${this.IDENTIFIER_COLUMN}, '-', 1), 10, '0') ELSE ${this.IDENTIFIER_COLUMN} END`
		);
	}
}

// Legacy function exports for backwards compatibility during migration
export const getDOADChunksByNumbers = async (doadNumbers: string[], hyperdrive: Hyperdrive): Promise<DOADChunk[]> => {
	const service = new DOADDatabaseService(hyperdrive);
	return service.getDOADChunksByNumbers(doadNumbers);
};

export const getDOADMetadataByNumbers = async (doadNumbers: string[], hyperdrive: Hyperdrive): Promise<DOADMetadata[]> => {
	const service = new DOADDatabaseService(hyperdrive);
	return service.getDOADMetadataByNumbers(doadNumbers);
};

export const getDOADChunksByIds = async (chunkIds: string[], hyperdrive: Hyperdrive): Promise<DOADChunk[]> => {
	const service = new DOADDatabaseService(hyperdrive);
	return service.getDOADChunksByIds(chunkIds);
};

export const getAvailableDOADNumbers = async (hyperdrive: Hyperdrive): Promise<string[]> => {
	const service = new DOADDatabaseService(hyperdrive);
	return service.getAvailableDOADNumbers();
};

/**
 * Enhance metadata with DOAD-specific context for LLM processing
 */
function enhanceMetadataForLLM(metadata: Record<string, any>, doadNumber: string): Record<string, any> {
	return formatMetadataForLLM(metadata, doadNumber, 'doad');
}

/**
 * Format chunks for LLM consumption with XML structure for better parsing
 * Includes DOAD context, metadata, and chunk organization using XML tags
 */
export const formatChunksForLLM = (chunks: DOADChunk[]): string => {
	if (chunks.length === 0) return '<policy_content></policy_content>';

	// Group chunks by DOAD number for better organization
	const groupedChunks = chunks.reduce(
		(acc, chunk) => {
			const doadNum = chunk.doadNumber || 'Unknown';
			if (!acc[doadNum]) acc[doadNum] = [];
			acc[doadNum].push(chunk);
			return acc;
		},
		{} as Record<string, DOADChunk[]>
	);

	const content = Object.entries(groupedChunks)
		.map(([doadNumber, doadChunks]) => {
			const chunksXml = doadChunks
				.map((chunk) => {
					const metadata = chunk.metadata ? `<metadata>${JSON.stringify(chunk.metadata)}</metadata>` : '';
					return `<chunk id="${chunk.id}">${metadata}<content>${chunk.textChunk}</content></chunk>`;
				})
				.join('\n');

			return `<doad number="${doadNumber}">\n${chunksXml}\n</doad>`;
		})
		.join('\n');

	return `<policy_content>\n${content}\n</policy_content>`;
};
