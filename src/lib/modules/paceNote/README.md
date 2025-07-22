# PaceNote Service

> **🤖 AI Agent Navigation** | **Status**: ✅ Production Ready | **Domain**: Performance Feedback

## 🔍 Quick Reference

**Entry Point**: `service.ts` → `PaceNoteService` class  
**Types**: `types.ts` → `PaceNoteInput`, `PaceNoteOutput`, `PaceNoteRank`  
**Route Integration**: `src/routes/pacenote/` → UI + server logic  
**Dependencies**: AI Gateway, R2 Storage  
**Performance**: Rank-specific feedback generation with competency mapping

**Key Files**: `service.ts` (core logic), `constants.ts` (rank mappings), `types.ts` (type definitions), `prompts/base.md` (AI template)

**Related**: `src/routes/pacenote/+page.server.ts` (server integration)

## Purpose

Generate professional performance feedback notes for CAF members based on observations and rank-specific competencies. Provides AI-powered feedback generation with rank-appropriate language and competency mapping.

## Directory Structure

```
paceNote/
├── README.md           # This documentation
├── index.ts            # Module exports
├── service.ts          # Main PaceNoteService class
├── types.ts            # TypeScript definitions
├── constants.ts        # Configuration and rank mappings
└── prompts/
    └── base.md         # AI prompt template
```

## 🔄 Integration Points

### With Routes (`src/routes/pacenote/`)
- **Form Handling**: Server actions validate input and call service
- **UI Components**: Form, results, and tips components
- **Service Integration**: Direct import from module

### With Shared Services
- **AI Gateway**: Uses `createAIGatewayService()` for LLM calls
- **R2 Storage**: Retrieves competency files via `readFileAsText()`
- **Configuration**: Environment variables and validation constants

### External Dependencies
- **LLM Provider**: OpenRouter via AI Gateway
- **Storage**: Cloudflare R2 for competency files
- **Types**: Full TypeScript integration

## Key Features

### Rank-Specific System
- **Supported Ranks**: Cpl, MCpl, Sgt, WO
- **Competency Mapping**: Each rank has specific competencies and expectations
- **Context Awareness**: AI adapts language and expectations to rank level

### AI-Powered Generation
- **Professional Language**: Military feedback terminology
- **Contextual Feedback**: Incorporates observations with competencies
- **Usage Tracking**: Cost monitoring and performance metrics

## Development

### Adding New Ranks
1. Update `AVAILABLE_RANKS` in `constants.ts`
2. Add rank competency file to R2 storage
3. Update `PaceNoteRank` type in `types.ts`
4. Test with new rank input

### Service Configuration
- **Factory Function**: `createPaceNoteService()` for service instantiation
- **Input Validation**: Comprehensive validation of user inputs
- **Error Handling**: Graceful error handling with descriptive messages
- **Performance**: Optimized prompt design and token management

