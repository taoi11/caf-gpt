// Re-export types from server/types.ts
// This file is used as a bridge for client modules to access types
export type { 
    // Message types
    Message,
    MessageRole,
    
    // UI types
    UIState, 
    UIElements,
    
    // API response
    ApiResponse,
    
    // Tool-specific types
    PaceNoteRequest,
    PaceNoteResponse,
    
    // Policy types
    ChatResponse,
    PolicyTool
} from '../../server/types.js'; 