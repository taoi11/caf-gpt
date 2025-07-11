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

export interface LeaveFinderInput {
	messages: Array<{ role: string; content: string }>;
	finderPrompt: string;
	chapterList: string;
}

export interface LeaveFinderOutput {
	chapters: string[];
	usage: any;
}