/**
 * Common database types for policy content retrieval
 * Shared across DOAD and Leave policy modules
 */

// Base interface for all policy chunks
export interface PolicyChunk {
	id: string;
	textChunk: string;
	metadata: Record<string, any>;
	createdAt: string;
}

// Base interface for policy metadata (used for LLM selection)
export interface PolicyMetadata {
	id: string;
	metadata: Record<string, any>;
}

// Database query result wrapper
export interface DatabaseQueryResult<T> {
	data: T[];
	count: number;
	executionTime: number;
}

// Common database operation options
export interface QueryOptions {
	timeout?: number;
	logSlowQueries?: boolean;
}

// Statistics query result
export interface DatabaseStats {
	totalChunks: number;
	lastUpdated: string;
	tablesInfo: {
		name: string;
		rowCount: number;
		sizeBytes?: number;
	}[];
}
