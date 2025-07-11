import { query } from '../../../server/db/client';
import type { LeaveChunk, LeaveMetadata } from './types';

/**
 * Fetch all chunks for specified chapters with optimized query
 * Uses indexed lookup and only selects required columns for performance
 */
export const getLeaveChunksByChapters = async (chapters: string[]): Promise<LeaveChunk[]> => {
	if (chapters.length === 0) return [];

	const placeholders = chapters.map((_, i) => `$${i + 1}`).join(', ');

	// Optimized query: only select needed columns, use index on chapter
	const sql = `
    SELECT id, chapter, text_chunk, created_at, metadata
    FROM leave_2025 
    WHERE chapter IN (${placeholders})
    ORDER BY chapter, created_at
  `;

	const rows = await query(sql, chapters);

	// Type-safe mapping with proper date handling
	return rows.map((row) => ({
		id: row.id,
		textChunk: row.text_chunk,
		metadata: row.metadata || {},
		createdAt: row.created_at?.toISOString() || new Date().toISOString(),
		chapter: row.chapter || ''
	}));
};

/**
 * Fetch metadata only for specified chapters (optimized for LLM selection)
 * Uses efficient query that excludes large text_chunk field
 */
export const getLeaveMetadataByChapters = async (chapters: string[]): Promise<LeaveMetadata[]> => {
	if (chapters.length === 0) return [];

	const placeholders = chapters.map((_, i) => `$${i + 1}`).join(', ');

	// Metadata-only query for faster transfer and processing
	const sql = `
    SELECT id, metadata, chapter
    FROM leave_2025 
    WHERE chapter IN (${placeholders}) 
      AND metadata IS NOT NULL
	ORDER BY CAST(chapter AS INTEGER)
  `;

	const rows = await query(sql, chapters);

	return rows.map((row) => ({
		id: row.id,
		metadata: enhanceMetadataForLLM(row.metadata, row.chapter)
	}));
};

/**
 * Fetch specific chunks by IDs (used after metadata selection)
 * Optimized for final content retrieval
 */
export const getLeaveChunksByIds = async (chunkIds: string[]): Promise<LeaveChunk[]> => {
	if (chunkIds.length === 0) return [];

	const placeholders = chunkIds.map((_, i) => `$${i + 1}`).join(', ');

	// Direct ID lookup using primary key index (fastest possible query)
	const sql = `
    SELECT id, chapter, text_chunk, created_at, metadata
    FROM leave_2025 
    WHERE id IN (${placeholders})
    ORDER BY chapter, created_at
  `;

	const rows = await query(sql, chunkIds);

	return rows.map((row) => ({
		id: row.id,
		textChunk: row.text_chunk,
		metadata: row.metadata || {},
		createdAt: row.created_at?.toISOString() || new Date().toISOString(),
		chapter: row.chapter || ''
	}));
};

/**
 * Get all available chapters for finder agent
 */
export const getAvailableChapters = async (): Promise<string[]> => {
	const sql = `
    SELECT DISTINCT chapter 
    FROM leave_2025 
    ORDER BY chapter
  `;

	const rows = await query(sql);
	return rows.map((row) => row.chapter);
};

/**
 * Format chunks for LLM consumption with metadata and clear boundaries
 * Includes chapter context, metadata, and chunk organization for better agent understanding
 */
export const formatChunksForLLM = (chunks: LeaveChunk[]): string => {
	if (chunks.length === 0) return '';

	// Group chunks by chapter for better organization
	const groupedChunks = chunks.reduce(
		(acc, chunk) => {
			const chapterNum = chunk.chapter || 'Unknown';
			if (!acc[chapterNum]) acc[chapterNum] = [];
			acc[chapterNum].push(chunk);
			return acc;
		},
		{} as Record<string, LeaveChunk[]>
	);

	// Format each chapter section with clear boundaries and metadata
	const formattedSections = Object.entries(groupedChunks).map(([chapter, chapterChunks]) => {
		const chunkContent = chapterChunks
			.map((chunk, index) => {
				// Format metadata as JSON string, handling null/undefined cases
				const metadataStr =
					chunk.metadata && Object.keys(chunk.metadata).length > 0
						? JSON.stringify(chunk.metadata, null, 2)
						: '{"content_type": "leave_policy"}';

				return `--- Chunk ${index + 1} ---
METADATA: ${metadataStr}
CONTENT:
${chunk.textChunk}
-----------------------`;
			})
			.join('\n\n');

		return `=== ${chapter} ===\n${chunkContent}`;
	});

	return formattedSections.join('\n\n');
};

/**
 * Batch operation to fetch both metadata and chunk counts for analytics
 * Uses single query for efficiency
 */
export const getLeaveStatsByChapters = async (
	chapters: string[]
): Promise<
	Array<{
		chapter: string;
		chunkCount: number;
		hasMetadata: boolean;
	}>
> => {
	if (chapters.length === 0) return [];

	const placeholders = chapters.map((_, i) => `$${i + 1}`).join(', ');

	// Aggregated query for analytics - pushes computation to database
	const sql = `
    SELECT 
      chapter,
      COUNT(*) as chunk_count,
      COUNT(metadata) > 0 as has_metadata
    FROM leave_2025 
    WHERE chapter IN (${placeholders})
	GROUP BY chapter
	ORDER BY CAST(chapter AS INTEGER)
  `;

	const rows = await query(sql, chapters);

	return rows.map((row) => ({
		chapter: row.chapter,
		chunkCount: parseInt(row.chunk_count, 10),
		hasMetadata: Boolean(row.has_metadata)
	}));
};

/**
 * Enhanced metadata formatting for LLM processing
 * Adds contextual information and standardizes format
 */
function enhanceMetadataForLLM(metadata: any, chapter: string): Record<string, any> {
	if (!metadata || typeof metadata !== 'object') {
		return { chapter: chapter, content_type: 'leave_policy' };
	}

	// Ensure metadata includes chapter context and standardized fields
	return {
		...metadata,
		chapter: chapter,
		content_type: metadata.content_type || 'leave_policy',
		// Add any additional standardized fields for LLM processing
		...(metadata.section && { section: metadata.section }),
		...(metadata.section_title && { section_title: metadata.section_title }),
		...(metadata.chapter_title && { chapter_title: metadata.chapter_title })
	};
}
