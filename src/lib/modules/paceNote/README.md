# PaceNote Service

## Purpose

Generate professional performance feedback notes for CAF members based on observations and rank-specific competencies. Provides structured, AI-powered feedback generation with rank-appropriate language and competency mapping.

## Overview

PaceNote implements a complete feedback generation system with:

- **Rank-Specific Competencies**: Tailored feedback based on CAF rank structure (Cpl, MCpl, Sgt, WO)
- **AI-Powered Generation**: Uses LLM to create professional, contextual feedback
- **Structured Input/Output**: Type-safe interfaces for reliable integration
- **Co-located Architecture**: Service module + route-specific UI components
- **Usage Tracking**: Built-in cost monitoring and performance metrics

## Architecture

### Service Layer (`src/lib/modules/paceNote/`)

```
paceNote/
├── service.ts           # Main PaceNoteService class
├── types.ts            # TypeScript definitions
├── constants.ts        # Configuration and rank mappings
├── index.ts            # Module exports
└── prompts/
    └── base.md         # AI prompt template
```

### Route Integration (`src/routes/pacenote/`)

```
pacenote/
├── +page.server.ts           # Server-side logic & form actions
├── +page.svelte             # Main page orchestration
├── PaceNoteForm.svelte      # Form input and validation
├── PaceNoteResults.svelte   # Results display
├── PaceNoteTips.svelte      # Usage guidance
├── config.server.ts         # Configuration loading
├── form.server.ts           # Form validation logic
└── ui.ts                    # Route-specific utilities
```

## Service API

### PaceNoteService Class

```typescript
class PaceNoteService {
	constructor(
		openrouterToken: string,
		aiGatewayBaseURL: string,
		model: string,
		policiesBucket: R2Bucket,
		cfAigToken?: string
	);

	async generatePaceNote(input: PaceNoteInput): Promise<PaceNoteOutput>;
	async validateInput(input: PaceNoteInput): Promise<void>;
}
```

### Factory Function

```typescript
createPaceNoteService(
  openrouterToken: string,
  aiGatewayBaseURL: string,
  model: string,
  policiesBucket: R2Bucket,
  cfAigToken?: string
): PaceNoteService
```

## Data Types

### Input Interface

```typescript
interface PaceNoteInput {
	rank: PaceNoteRank; // 'Cpl' | 'MCpl' | 'Sgt' | 'WO'
	observations: string; // Detailed observations
	memberName?: string; // Optional member name
	reportingPeriod?: string; // Optional reporting period
}
```

### Output Interface

```typescript
interface PaceNoteOutput {
	paceNote: string; // Generated feedback content
	usage: {
		promptTokens: number; // Input tokens used
		completionTokens: number; // Output tokens used
		totalTokens: number; // Total tokens
		estimatedCost: number; // Estimated cost in USD
	};
	metadata: {
		rank: PaceNoteRank; // Rank used for generation
		timestamp: string; // Generation timestamp
		model: string; // AI model used
	};
}
```

## Rank-Specific Competencies

### Supported Ranks

- **Cpl (Corporal)**: Team leadership, technical competence
- **MCpl (Master Corporal)**: Section leadership, mentoring
- **Sgt (Sergeant)**: Operational leadership, training oversight
- **WO (Warrant Officer)**: Strategic oversight, professional development

### Competency Mapping

Each rank has specific competency areas that influence feedback generation:

```typescript
const AVAILABLE_RANKS = {
	Cpl: {
		name: 'Corporal',
		competencies: ['Technical Skills', 'Team Integration', 'Initiative']
	},
	MCpl: {
		name: 'Master Corporal',
		competencies: ['Leadership', 'Mentoring', 'Decision Making']
	}
	// ... additional ranks
} as const;
```

## Usage Example

### Service Integration

```typescript
// Create service instance
const paceNoteService = createPaceNoteService(
	env.OPENROUTER_TOKEN,
	env.AI_GATEWAY_BASE_URL,
	env.FN_MODEL,
	env.POLICIES,
	env.CF_AIG_TOKEN
);

// Generate pace note
const result = await paceNoteService.generatePaceNote({
	rank: 'Sgt',
	observations: 'Consistently demonstrates strong leadership...',
	memberName: 'Cpl Smith',
	reportingPeriod: 'Jan-Jun 2025'
});

console.log('Generated feedback:', result.paceNote);
console.log('Cost estimate:', result.usage.estimatedCost);
```

### SvelteKit Route Integration

```typescript
// +page.server.ts
import { createPaceNoteService } from '$lib/modules/paceNote';

export const actions = {
	generatePaceNote: async ({ request, platform }) => {
		const formData = await request.formData();
		const service = createPaceNoteService(/* ... */);

		const result = await service.generatePaceNote({
			rank: formData.get('rank'),
			observations: formData.get('observations'),
			memberName: formData.get('memberName')
		});

		return { success: true, result };
	}
};
```

## Configuration

### Environment Variables

```bash
# Required
OPENROUTER_TOKEN=your_openrouter_token
AI_GATEWAY_BASE_URL=your_ai_gateway_url

# Optional
CF_AIG_TOKEN=enhanced_monitoring_token
FN_MODEL=openai/gpt-4o-mini  # Default model
```

### Validation Limits

```typescript
const VALIDATION_LIMITS = {
	observations: {
		minLength: 10,
		maxLength: 2000
	},
	memberName: {
		maxLength: 100
	},
	reportingPeriod: {
		maxLength: 50
	}
} as const;
```

## AI Integration

### Model Selection

- **Default Model**: `openai/gpt-4o-mini` (cost-effective)
- **Alternative**: `claude-3-haiku` (faster responses)
- **Configurable**: Via `FN_MODEL` environment variable

### Prompt Engineering

The service uses a structured prompt template (`prompts/base.md`) that includes:

- Role definition (professional military feedback writer)
- Rank-specific competency guidelines
- Output format requirements
- Professional language standards
- CAF-specific terminology

### Cost Monitoring

Built-in usage tracking provides:

- Token consumption (input/output)
- Estimated cost per generation
- Performance metrics
- Error rate monitoring

## Testing

### Unit Tests

```bash
# Run PaceNote service tests
npm test -- src/lib/modules/paceNote

# Run with coverage
npm run test:coverage -- src/lib/modules/paceNote
```

### Integration Tests

```bash
# Test full workflow
npm run test:integration -- pacenote

# Test route functionality
npm test -- src/routes/pacenote
```

### Test Data

```typescript
const mockInput: PaceNoteInput = {
	rank: 'Sgt',
	observations: 'Demonstrates excellent leadership during training exercises...',
	memberName: 'Cpl Johnson',
	reportingPeriod: 'Q1 2025'
};
```

## Error Handling

### Validation Errors

```typescript
class PaceNoteValidationError extends Error {
	field: string;
	constraint: string;
}
```

### AI Gateway Errors

```typescript
class PaceNoteAIError extends Error {
	code: string;
	retryable: boolean;
}
```

### Error Recovery

- Automatic retry for transient failures
- Graceful degradation for service outages
- User-friendly error messages
- Detailed logging for debugging

## Performance Considerations

### Optimization Strategies

- **Prompt Caching**: Reuse base prompts across requests
- **Model Selection**: Use cost-effective models for routine feedback
- **Connection Pooling**: Efficient AI Gateway connections
- **Request Batching**: Group multiple generations when possible

### Monitoring

- Response time tracking
- Token usage analytics
- Error rate monitoring
- Cost analysis and budgeting

## Migration Notes

### From Legacy Implementation

- Migrated from Workers AI to AI Gateway for better reliability
- Consolidated R2 utilities into shared service layer
- Added comprehensive type safety
- Improved error handling and monitoring

### Breaking Changes

- Service constructor signature changed
- Response format includes detailed usage metrics
- Validation rules strengthened
- Configuration moved to constants file
