import { query } from '../../../core/db/client';
import type { DOADChunk, DOADMetadata } from '../types.js';

/**
 * Fetch all chunks for specified DOAD numbers with optimized query
 * Uses indexed lookup and only selects required columns for performance
 */
export const getDOADChunksByNumbers = async (doadNumbers: string[]): Promise<DOADChunk[]> => {
	if (doadNumbers.length === 0) return [];

	const placeholders = doadNumbers.map((_, i) => `$${i + 1}`).join(', ');

	// Optimized query: only select needed columns, use index on doad_number
	const sql = `
    SELECT id, doad_number, text_chunk, created_at, metadata
    FROM doad 
    WHERE doad_number IN (${placeholders})
    ORDER BY doad_number, created_at
  `;

	const rows = await query(sql, doadNumbers);

	// Type-safe mapping with proper date handling
	return rows.map((row) => ({
		id: row.id,
		textChunk: row.text_chunk,
		metadata: row.metadata || {},
		createdAt: row.created_at?.toISOString() || new Date().toISOString(),
		doadNumber: row.doad_number || ''
	}));
};

/**
 * Fetch metadata only for specified DOAD numbers (optimized for LLM selection)
 * Uses efficient query that excludes large text_chunk field
 */
export const getDOADMetadataByNumbers = async (doadNumbers: string[]): Promise<DOADMetadata[]> => {
	if (doadNumbers.length === 0) return [];

	const placeholders = doadNumbers.map((_, i) => `$${i + 1}`).join(', ');

	// Metadata-only query for faster transfer and processing
	const sql = `
    SELECT id, metadata, doad_number
    FROM doad 
    WHERE doad_number IN (${placeholders}) 
      AND metadata IS NOT NULL
    ORDER BY doad_number
  `;

	const rows = await query(sql, doadNumbers);

	return rows.map((row) => ({
		id: row.id,
		metadata: enhanceMetadataForLLM(row.metadata, row.doad_number)
	}));
};

/**
 * Fetch specific chunks by IDs (used after metadata selection)
 * Optimized for final content retrieval
 */
export const getDOADChunksByIds = async (chunkIds: string[]): Promise<DOADChunk[]> => {
	if (chunkIds.length === 0) return [];

	const placeholders = chunkIds.map((_, i) => `$${i + 1}`).join(', ');

	// Direct ID lookup using primary key index (fastest possible query)
	const sql = `
    SELECT id, doad_number, text_chunk, created_at, metadata
    FROM doad 
    WHERE id IN (${placeholders})
    ORDER BY doad_number, created_at
  `;

	const rows = await query(sql, chunkIds);

	return rows.map((row) => ({
		id: row.id,
		textChunk: row.text_chunk,
		metadata: row.metadata || {},
		createdAt: row.created_at?.toISOString() || new Date().toISOString(),
		doadNumber: row.doad_number || ''
	}));
};

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

	// Format each DOAD section with XML structure
	const formattedSections = Object.entries(groupedChunks).map(([doadNumber, doadChunks]) => {
		const chunkContent = doadChunks
			.map((chunk, index) => {
				// Format metadata as proper XML attributes and content
				const metadataObj =
					chunk.metadata && Object.keys(chunk.metadata).length > 0
						? chunk.metadata
						: { content_type: 'policy_text' };

				// Create XML attributes from metadata
				const xmlAttributes = Object.entries(metadataObj)
					.map(([key, value]) => `${key}="${String(value).replace(/"/g, '&quot;')}"`)
					.join(' ');

				return `<chunk id="${chunk.id}" index="${index + 1}" ${xmlAttributes}>
<metadata>
${Object.entries(metadataObj)
	.map(([key, value]) => `<${key}>${String(value)}</${key}>`)
	.join('\n')}
</metadata>
<content>
${chunk.textChunk}
</content>
</chunk>`;
			})
			.join('\n\n');

		return `<doad number="${doadNumber}">
${chunkContent}
</doad>`;
	});

	return `<policy_content>
${formattedSections.join('\n\n')}
</policy_content>`;
};
/**
 * Batch operation to fetch both metadata and chunk counts for analytics
 * Uses single query for efficiency
 */
export const getDOADStatsByNumbers = async (
	doadNumbers: string[]
): Promise<
	Array<{
		doadNumber: string;
		chunkCount: number;
		hasMetadata: boolean;
	}>
> => {
	if (doadNumbers.length === 0) return [];

	const placeholders = doadNumbers.map((_, i) => `$${i + 1}`).join(', ');

	// Aggregated query for analytics - pushes computation to database
	const sql = `
    SELECT 
      doad_number,
      COUNT(*) as chunk_count,
      COUNT(metadata) > 0 as has_metadata
    FROM doad 
    WHERE doad_number IN (${placeholders})
    GROUP BY doad_number
    ORDER BY doad_number
  `;

	const rows = await query(sql, doadNumbers);

	return rows.map((row) => ({
		doadNumber: row.doad_number,
		chunkCount: parseInt(row.chunk_count, 10),
		hasMetadata: Boolean(row.has_metadata)
	}));
};

/**
 * Enhanced metadata formatting for LLM processing
 * Adds contextual information and standardizes format
 */
function enhanceMetadataForLLM(metadata: any, doadNumber: string): Record<string, any> {
	if (!metadata || typeof metadata !== 'object') {
		return { doad_number: doadNumber, content_type: 'policy_text' };
	}

	// Ensure metadata includes DOAD context and standardized fields
	return {
		...metadata,
		doad_number: doadNumber,
		content_type: metadata.content_type || 'policy_text',
		// Add any additional standardized fields for LLM processing
		...(metadata.section && { section: metadata.section }),
		...(metadata.topic && { topic: metadata.topic }),
		...(metadata.keywords && { keywords: metadata.keywords })
	};
}
