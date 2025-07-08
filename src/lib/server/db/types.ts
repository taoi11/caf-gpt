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
