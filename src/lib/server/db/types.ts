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
