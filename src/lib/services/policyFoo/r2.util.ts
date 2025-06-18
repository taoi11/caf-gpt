/// <reference types="@cloudflare/workers-types" />

/**
 * R2 Utility for PolicyFoo Service
 * 
 * Independent R2 utility for PolicyFoo module.
 * Handles file operations with Cloudflare R2 storage for policy documents.
 */

import type { PolicyFooError } from './types';
import { ERROR_MESSAGES } from './constants';

/**
 * Read a file from an R2 bucket and return its content as text
 * 
 * @param bucket - R2 bucket binding
 * @param key - Object key (file path)
 * @returns Promise with the file content as text
 */
export async function readPolicyFileAsText(bucket: R2Bucket, key: string): Promise<string> {
	try {
		const object = await bucket.get(key);
		
		if (!object) {
			throw createPolicyR2Error('POLICY_FILE_NOT_FOUND', `File not found: ${key}`);
		}

		return await object.text();
	} catch (error) {
		if (error && typeof error === 'object' && 'code' in error) {
			// Re-throw PolicyFooError as-is
			throw error;
		}
		
		console.error('R2 read error:', error);
		throw createPolicyR2Error('R2_ERROR', 
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
		throw createPolicyR2Error('R2_ERROR', 
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

/**
 * Create a standardized PolicyFoo R2 error
 */
function createPolicyR2Error(
	code: PolicyFooError['code'], 
	message: string, 
	details?: Record<string, unknown>
): PolicyFooError {
	return {
		code,
		message: `${ERROR_MESSAGES[code]}: ${message}`,
		details
	};
}
