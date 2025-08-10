/**
 * Core Types
 *
 * Local and internal types specific to the core module.
 * These are infrastructure types used within the core module.
 */

// Database Types

export interface DOADChunk {
	id: string;
	textChunk: string;
	metadata: Record<string, any>;
	createdAt: string;
	doadNumber: string;
}

export interface DOADMetadata {
	id: string;
	metadata: Record<string, any>;
}

export interface LeaveChunk {
	id: string;
	textChunk: string;
	metadata: Record<string, any>;
	createdAt: string;
	chapter: string;
}

export interface LeaveMetadata {
	id: string;
	metadata: Record<string, any>;
}

/**
 * Environment variable extensions for secrets
 * These are loaded from .dev.vars in development or set as Wrangler secrets in production
 */
declare global {
	namespace Cloudflare {
		interface Env {
			// Secret environment variables (must be present at runtime in prod/dev)
			OPENROUTER_TOKEN: string;
			AI_GATEWAY_BASE_URL: string;
			CF_AIG_TOKEN: string;
		}
	}
}
