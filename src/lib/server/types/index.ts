// Main Types File

// General Types
export interface GeneralMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export interface GeneralResponse {
	response: string;
	usage?: {
		prompt_tokens?: number;
		completion_tokens?: number;
		total_tokens?: number;
	};
	cost?: number;
}

export interface GeneralError {
	code: string;
	message: string;
	details?: Record<string, unknown>;
}

// Workers AI Types
export interface WorkersAIMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export interface WorkersAIResponse {
	response: string;
	usage?: {
		prompt_tokens?: number;
		completion_tokens?: number;
		total_tokens?: number;
	};
	cost?: number;
}

export interface WorkersAIError {
	code: string;
	message: string;
	details?: Record<string, unknown>;
}