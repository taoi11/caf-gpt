// Test fixture factory for generating consistent test data

export const createMockUser = (overrides = {}) => ({
	id: 'user_test_123',
	email: 'test@example.com',
	name: 'Test User',
	role: 'user' as const,
	createdAt: new Date('2024-01-01'),
	updatedAt: new Date('2024-01-01'),
	...overrides
});

export const createMockPacenoteSession = (overrides = {}) => ({
	id: 'session_test_123',
	userId: 'user_test_123',
	title: 'Test Chat Session',
	status: 'active' as const,
	metadata: {},
	createdAt: new Date('2024-01-01'),
	updatedAt: new Date('2024-01-01'),
	...overrides
});

export const createMockPacenoteMessage = (overrides = {}) => ({
	id: 'message_test_123',
	sessionId: 'session_test_123',
	role: 'user' as const,
	content: 'Test message content',
	tokens: 10,
	cost: 0.001,
	metadata: {},
	createdAt: new Date('2024-01-01'),
	...overrides
});

export const createMockPolicyDocument = (overrides = {}) => ({
	id: 'doc_test_123',
	userId: 'user_test_123',
	filename: 'test-policy.pdf',
	originalName: 'Test Policy Document.pdf',
	mimeType: 'application/pdf',
	size: 1024000,
	status: 'ready' as const,
	r2Key: 'documents/test-policy.pdf',
	processingError: null,
	metadata: {},
	createdAt: new Date('2024-01-01'),
	updatedAt: new Date('2024-01-01'),
	...overrides
});

// Mock API responses
export const mockWorkersAIResponse = {
	response: 'This is a mock AI response for testing.',
	usage: {
		prompt_tokens: 10,
		completion_tokens: 15,
		total_tokens: 25
	},
	cost: 0.00375 // $0.00375 for 25 tokens
};

export const mockR2UploadResponse = {
	success: true,
	key: 'documents/test-file.pdf',
	url: 'https://example.com/test-file.pdf'
};
