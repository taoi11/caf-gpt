/**
 * Common database service patterns for policy content retrieval
 * Provides shared functionality across DOAD and Leave modules
 */
import { query } from './client.js';
import type { PolicyChunk, PolicyMetadata, DatabaseQueryResult, QueryOptions, DatabaseStats } from './types.js';

/**
 * Base database service class with common patterns
 */
export abstract class BasePolicyDatabaseService {
	protected hyperdrive: Hyperdrive;

	constructor(hyperdrive: Hyperdrive) {
		this.hyperdrive = hyperdrive;
	}

	/**
	 * Execute query with standard error handling and performance monitoring
	 */
	protected async executeQuery<T = any>(
		sql: string,
		params?: any[],
		options: QueryOptions = {}
	): Promise<DatabaseQueryResult<T>> {
		const startTime = Date.now();
		const retries = options.retries ?? 2;

		try {
			const data = await query(sql, this.hyperdrive, params, retries);
			const executionTime = Date.now() - startTime;

			return {
				data,
				count: data.length,
				executionTime
			};
		} catch (error) {
			console.error('Database query failed:', {
				sql: sql.substring(0, 100) + '...',
				error: error instanceof Error ? error.message : String(error)
			});
			throw error;
		}
	}

	/**
	 * Get chunks by IDs (optimized for final content retrieval)
	 * Common pattern across all policy modules
	 */
	protected async getChunksByIds(
		tableName: string,
		chunkIds: string[],
		identifierColumn: string = 'id'
	): Promise<PolicyChunk[]> {
		if (chunkIds.length === 0) return [];

		const placeholders = chunkIds.map((_, i) => `$${i + 1}`).join(', ');

		const sql = `
			SELECT id, text_chunk, created_at, metadata, ${identifierColumn}
			FROM ${tableName} 
			WHERE id IN (${placeholders})
			ORDER BY created_at
		`;

		const result = await this.executeQuery(sql, chunkIds);

		return result.data.map((row) => ({
			id: row.id,
			textChunk: row.text_chunk,
			metadata: row.metadata || {},
			createdAt: row.created_at?.toISOString() || new Date().toISOString()
		}));
	}

	/**
	 * Get metadata only for selection purposes (optimized for LLM processing)
	 * Common pattern for finder agents
	 */
	protected async getMetadataByIdentifiers(
		tableName: string,
		identifiers: string[],
		identifierColumn: string,
		orderBy: string = identifierColumn
	): Promise<PolicyMetadata[]> {
		if (identifiers.length === 0) return [];

		const placeholders = identifiers.map((_, i) => `$${i + 1}`).join(', ');

		const sql = `
			SELECT id, metadata, ${identifierColumn}
			FROM ${tableName} 
			WHERE ${identifierColumn} IN (${placeholders}) 
			  AND metadata IS NOT NULL
			ORDER BY ${orderBy}
		`;

		const result = await this.executeQuery(sql, identifiers);

		return result.data.map((row) => ({
			id: row.id,
			metadata: row.metadata || {}
		}));
	}

	/**
	 * Get all available identifiers for a policy type
	 * Used by finder agents to know what's available
	 */
	protected async getAvailableIdentifiers(
		tableName: string,
		identifierColumn: string,
		orderBy?: string
	): Promise<string[]> {
		const orderClause = orderBy ? `ORDER BY ${orderBy}` : `ORDER BY ${identifierColumn}`;

		const sql = `
			SELECT DISTINCT ${identifierColumn} 
			FROM ${tableName} 
			${orderClause}
		`;

		const result = await this.executeQuery(sql);
		return result.data.map((row) => row[identifierColumn]);
	}

	/**
	 * Get database statistics for monitoring
	 */
	protected async getTableStats(tableName: string): Promise<DatabaseStats['tablesInfo'][0]> {
		const sql = `
			SELECT 
				'${tableName}' as name,
				COUNT(*) as row_count,
				pg_total_relation_size('${tableName}') as size_bytes
			FROM ${tableName}
		`;

		const result = await this.executeQuery(sql);
		const row = result.data[0];

		return {
			name: tableName,
			rowCount: parseInt(row.row_count),
			sizeBytes: parseInt(row.size_bytes)
		};
	}
}

/**
 * Format metadata for LLM consumption
 * Enhances raw metadata with user-friendly descriptions
 */
export function formatMetadataForLLM(
	metadata: Record<string, any>,
	identifier: string,
	type: 'doad' | 'leave' = 'doad'
): Record<string, any> {
	const enhanced = { ...metadata };

	// Add identifier for context
	enhanced.identifier = identifier;
	enhanced.type = type;

	// Add readable summary if available
	if (metadata.title || metadata.subject) {
		enhanced.summary = metadata.title || metadata.subject;
	}

	// Add section context if available
	if (metadata.section || metadata.chapter) {
		enhanced.section_context = metadata.section || metadata.chapter;
	}

	return enhanced;
}

/**
 * Common database statistics aggregator
 */
export async function getDatabaseStats(hyperdrive: Hyperdrive, tables: string[]): Promise<DatabaseStats> {
	const service = new (class extends BasePolicyDatabaseService {
		async getStats() {
			const tablesInfo = await Promise.all(
				tables.map(table => this.getTableStats(table))
			);

			const totalChunks = tablesInfo.reduce((sum, table) => sum + table.rowCount, 0);

			// Get last updated timestamp
			const lastUpdatedQuery = `
				SELECT MAX(created_at) as last_updated
				FROM (${tables.map(table => `SELECT created_at FROM ${table}`).join(' UNION ALL ')}) as all_tables
			`;

			const result = await this.executeQuery(lastUpdatedQuery);
			const lastUpdated = result.data[0]?.last_updated?.toISOString() || new Date().toISOString();

			return {
				totalChunks,
				lastUpdated,
				tablesInfo
			};
		}
	})(hyperdrive);

	return service.getStats();
}
