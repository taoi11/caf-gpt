import { BasePolicyDatabaseService, formatMetadataForLLM } from '../../../core/db/service.js';
import type { LeaveChunk, LeaveMetadata } from '../types.js';

/**
 * Leave Database Service - extends common patterns with Leave-specific logic
 */
export class LeaveDatabaseService extends BasePolicyDatabaseService {
	private readonly TABLE_NAME = 'leave_2025';
	private readonly IDENTIFIER_COLUMN = 'chapter';

	/**
	 * Fetch all chunks for specified chapters with optimized query
	 */
	async getLeaveChunksByChapters(chapters: string[]): Promise<LeaveChunk[]> {
		if (chapters.length === 0) return [];

		const placeholders = chapters.map((_, i) => `$${i + 1}`).join(', ');

		const sql = `
			SELECT id, chapter, text_chunk, created_at, metadata
			FROM ${this.TABLE_NAME} 
			WHERE ${this.IDENTIFIER_COLUMN} IN (${placeholders})
			ORDER BY ${this.IDENTIFIER_COLUMN}, created_at
		`;

		const result = await this.executeQuery(sql, chapters);

		return result.data.map((row) => ({
			id: row.id,
			textChunk: row.text_chunk,
			metadata: row.metadata || {},
			createdAt: row.created_at?.toISOString() || new Date().toISOString(),
			chapter: row.chapter || ''
		}));
	}

	/**
	 * Fetch metadata only for specified chapters (optimized for LLM selection)
	 */
	async getLeaveMetadataByChapters(chapters: string[]): Promise<LeaveMetadata[]> {
		const metadata = await this.getMetadataByIdentifiers(
			this.TABLE_NAME,
			chapters,
			this.IDENTIFIER_COLUMN,
			'CAST(chapter AS INTEGER)'
		);

		// Create a map from chapter to metadata item for correct assignment
		const metadataMap = new Map<string, (typeof metadata)[number]>();
		for (const item of metadata) {
			const chapterKey = String(item[this.IDENTIFIER_COLUMN] ?? item.chapter ?? '');
			metadataMap.set(chapterKey, item);
		}

		return chapters.map((chapter) => {
			const item = metadataMap.get(String(chapter));
			return item
				? {
						id: item.id,
						metadata: enhanceMetadataForLLM(item.metadata, chapter)
					}
				: {
						id: '',
						metadata: enhanceMetadataForLLM({}, chapter)
					};
		});
	}

	/**
	 * Fetch specific chunks by IDs (used after metadata selection)
	 */
	async getLeaveChunksByIds(chunkIds: string[]): Promise<LeaveChunk[]> {
		const chunks = await this.getChunksByIds(this.TABLE_NAME, chunkIds);

		return chunks.map((chunk) => ({
			...chunk,
			chapter: chunk.metadata?.chapter || ''
		})) as LeaveChunk[];
	}

	/**
	 * Get all available chapters for finder agent
	 */
	async getAvailableChapters(): Promise<string[]> {
		return this.getAvailableIdentifiers(
			this.TABLE_NAME,
			this.IDENTIFIER_COLUMN,
			this.IDENTIFIER_COLUMN
		);
	}
}

// Legacy function exports for backwards compatibility during migration
export const getLeaveChunksByChapters = async (
	chapters: string[],
	hyperdrive: Hyperdrive
): Promise<LeaveChunk[]> => {
	const service = new LeaveDatabaseService(hyperdrive);
	return service.getLeaveChunksByChapters(chapters);
};

export const getLeaveMetadataByChapters = async (
	chapters: string[],
	hyperdrive: Hyperdrive
): Promise<LeaveMetadata[]> => {
	const service = new LeaveDatabaseService(hyperdrive);
	return service.getLeaveMetadataByChapters(chapters);
};

export const getLeaveChunksByIds = async (
	chunkIds: string[],
	hyperdrive: Hyperdrive
): Promise<LeaveChunk[]> => {
	const service = new LeaveDatabaseService(hyperdrive);
	return service.getLeaveChunksByIds(chunkIds);
};

export const getAvailableChapters = async (hyperdrive: Hyperdrive): Promise<string[]> => {
	const service = new LeaveDatabaseService(hyperdrive);
	return service.getAvailableChapters();
};

/**
 * Enhance metadata with Leave-specific context for LLM processing
 */
function enhanceMetadataForLLM(
	metadata: Record<string, any>,
	chapter: string
): Record<string, any> {
	const enhanced = formatMetadataForLLM(metadata, chapter, 'leave');

	// Add chapter-specific enhancements
	if (metadata.section || metadata.topic) {
		enhanced.leave_section = metadata.section || metadata.topic;
	}

	// Add chapter context
	enhanced.chapter_number = chapter;

	return enhanced;
}

/**
 * Format chunks for LLM consumption with XML structure for better parsing
 * Includes Leave context, metadata, and chunk organization using XML tags
 */
export const formatChunksForLLM = (chunks: LeaveChunk[]): string => {
	if (chunks.length === 0) return '<policy_content></policy_content>';

	// Group chunks by chapter for better organization
	const groupedChunks = chunks.reduce(
		(acc, chunk) => {
			const chapter = chunk.chapter || 'Unknown';
			if (!acc[chapter]) acc[chapter] = [];
			acc[chapter].push(chunk);
			return acc;
		},
		{} as Record<string, LeaveChunk[]>
	);

	const content = Object.entries(groupedChunks)
		.sort(([a], [b]) => parseInt(a) - parseInt(b)) // Sort chapters numerically
		.map(([chapter, leaveChunks]) => {
			const chunksXml = leaveChunks
				.map((chunk) => {
					const metadata = chunk.metadata
						? `<metadata>${JSON.stringify(chunk.metadata)}</metadata>`
						: '';
					return `<chunk id="${chunk.id}">${metadata}<content>${chunk.textChunk}</content></chunk>`;
				})
				.join('\n');

			return `<chapter number="${chapter}">\n${chunksXml}\n</chapter>`;
		})
		.join('\n');

	return `<policy_content>\n${content}\n</policy_content>`;
};
