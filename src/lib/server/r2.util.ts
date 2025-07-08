/// <reference types="@cloudflare/workers-types" />

/**
 * Consolidated R2 Utility Functions
 * 
 * Centralized utility functions for Cloudflare R2 storage operations.
 * Provides consistent error handling and standardized functionality
 * across all modules that interact with R2.
 */

/**
 * Standard R2 error types
 */
export interface R2Error {
	code: 
		| 'FILE_NOT_FOUND'
		| 'R2_ERROR'
		| 'PARSING_ERROR'
		| 'GENERAL_ERROR';
	message: string;
	details?: Record<string, unknown>;
}

/**
 * Error messages for R2 operations
 */
const R2_ERROR_MESSAGES = {
	FILE_NOT_FOUND: 'File not found in R2 bucket',
	R2_ERROR: 'R2 bucket operation failed',
	PARSING_ERROR: 'Failed to parse R2 response',
	GENERAL_ERROR: 'An unexpected R2 error occurred'
} as const;

/**
 * Create a standardized R2 error
 */
function createR2Error(
	code: R2Error['code'], 
	message: string, 
	details?: Record<string, unknown>
): R2Error {
	return {
		code,
		message: `${R2_ERROR_MESSAGES[code]}: ${message}`,
		details
	};
}

/**
 * Read a file from an R2 bucket and return its content as text
 * 
 * @param bucket - R2 bucket binding
 * @param key - Object key (file path)
 * @returns Promise with the file content as text
 */
export async function readFileAsText(bucket: R2Bucket, key: string): Promise<string> {
	try {
		const object = await bucket.get(key);
		
		if (!object) {
			throw createR2Error('FILE_NOT_FOUND', `File not found: ${key}`);
		}

		return await object.text();
	} catch (error) {
		if (error && typeof error === 'object' && 'code' in error) {
			// Re-throw R2Error as-is
			throw error;
		}
		
		console.error('R2 read error:', error);
		throw createR2Error('R2_ERROR', 
			error instanceof Error ? error.message : 'Unknown R2 error',
			{ key, originalError: error }
		);
	}
}

/**
 * Read a policy file from an R2 bucket and return its content as text
 * 
 * @param bucket - R2 bucket binding
 * @param key - Object key (file path)
 * @returns Promise with the file content as text
 */
export async function readPolicyFileAsText(bucket: R2Bucket, key: string): Promise<string> {
	try {
		const object = await bucket.get(key);
		
		if (!object) {
			throw createR2Error('FILE_NOT_FOUND', `File not found: ${key}`);
		}

		return await object.text();
	} catch (error) {
		if (error && typeof error === 'object' && 'code' in error) {
			// Re-throw R2Error as-is
			throw error;
		}
		
		console.error('R2 read error:', error);
		throw createR2Error('R2_ERROR', 
			error instanceof Error ? error.message : 'Unknown R2 error',
			{ key, originalError: error }
		);
	}
}

/**
 * Read multiple policy files from R2 bucket
 * 
 * @param bucket - R2 bucket binding
 * @param keys - Array of object keys (file paths)
 * @returns Promise with array of file contents, maintaining order
 */
export async function readMultiplePolicyFiles(bucket: R2Bucket, keys: string[]): Promise<string[]> {
	try {
		const promises = keys.map(key => readPolicyFileAsText(bucket, key));
		return await Promise.all(promises);
	} catch (error) {
		console.error('Multiple R2 read error:', error);
		throw error; // Re-throw as readPolicyFileAsText already formats the error
	}
}

/**
 * Check if a policy file exists in R2 bucket
 * 
 * @param bucket - R2 bucket binding
 * @param key - Object key (file path)
 * @returns Promise with boolean indicating if file exists
 */
export async function policyFileExists(bucket: R2Bucket, key: string): Promise<boolean> {
	try {
		const object = await bucket.head(key);
		return object !== null;
	} catch (error) {
		console.error('R2 head error:', error);
		return false; // Assume file doesn't exist on error
	}
}

/**
 * List policy files with a given prefix
 * 
 * @param bucket - R2 bucket binding
 * @param prefix - Key prefix to filter by
 * @param maxKeys - Maximum number of keys to return (default: 1000)
 * @returns Promise with array of matching keys
 */
export async function listPolicyFiles(
	bucket: R2Bucket, 
	prefix: string, 
	maxKeys: number = 1000
): Promise<string[]> {
	try {
		const result = await bucket.list({
			prefix,
			limit: maxKeys
		});

		return result.objects.map(obj => obj.key);
	} catch (error) {
		console.error('R2 list error:', error);
		throw createR2Error('R2_ERROR', 
			error instanceof Error ? error.message : 'Unknown R2 list error',
			{ prefix, originalError: error }
		);
	}
}

/**
 * Construct policy file path based on policy set and policy number
 * 
 * @param policySet - The policy set (DOAD, LEAVE, etc.)
 * @param policyNumber - The policy number (e.g., "5017-1")
 * @returns Constructed file path
 */
export function constructPolicyFilePath(policySet: string, policyNumber: string): string {
	const prefix = policySet.toLowerCase();
	return `${prefix}/${policyNumber}.md`;
}

/**
 * Parse policy numbers from finder agent response
 * 
 * @param response - Raw response from finder agent
 * @returns Array of policy numbers, or empty array if "none"
 */
export function parsePolicyNumbers(response: string): string[] {
	const cleaned = response.trim().toLowerCase();
	
	if (cleaned === 'none' || cleaned === 'none found' || cleaned.includes('no relevant')) {
		return [];
	}
	
	// Split by commas and clean up each policy number
	return response
		.split(',')
		.map(num => num.trim())
		.filter(num => num.length > 0 && num.toLowerCase() !== 'none')
		.slice(0, 5); // Limit to max 5 policies as per constants
}