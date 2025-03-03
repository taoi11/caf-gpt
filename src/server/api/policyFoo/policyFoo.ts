/**
 * Core policy router implementation for handling policy tool requests.
 * Manages request routing, rate limiting, and integration of policy handlers.
 * Provides base interfaces for extending policy tool implementations.
 * 
 * Responsibilities:
 * - Maintains registry of policy handlers
 * - Enforces rate limiting
 * - Validates incoming requests
 * - Orchestrates request flow between components
 */
import type { ApiResponse, Message, PolicyTool, ChatResponse, PolicyHandler, PolicyRouter } from '../../types';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { PolicyRequest } from '../../types';
import { logger } from '../../utils/logger';
import { rateLimiter } from '../../utils/rateLimiter';
import { IncomingMessage } from 'http';
import { createDOADHandler } from './doad/doad';

// Policy tool implementation
// Note: Type is defined in types.ts

// Response formatter interface
export interface ResponseFormatter {
    formatResponse(response: ChatResponse): ChatResponse;
    validateRequest(message: string): boolean;
}

// Extended policy handler with formatting capabilities
export interface FormattedPolicyHandler extends PolicyHandler, ResponseFormatter {}

// Default response formatter implementation
/**
 * Default response formatter implementation ensuring consistent response structure.
 * Provides basic validation and response formatting for policy tool outputs.
 */
export const defaultResponseFormatter: ResponseFormatter = {
    validateRequest(message: string): boolean {
        return message.trim().length > 0;
    },
    
    formatResponse(response: ChatResponse): ChatResponse {
        return {
            answer: response.answer || '',
            citations: response.citations || [],
            followUp: response.followUp || ''
        };
    }
};

// Policy router implementation
interface PolicyRouterImpl extends PolicyRouter {
    handlers: Map<PolicyTool, PolicyHandler>;
}

/**
 * Creates concrete policy router instance with configured handlers
 * @returns Policy router implementation with:
 * - Handler registry
 * - Request validation
 * - Rate limiting enforcement
 * - Error handling
 */
function createPolicyRouterImpl(): PolicyRouterImpl {
    const handlers = new Map<PolicyTool, PolicyHandler>([
        ['doadFoo', createDOADHandler()]
    ]);

    return {
        handlers,
        /**
         * Processes policy tool request through configured handler
         * @param tool - Policy tool identifier from client
         * @param message - User message content
         * @param history - Conversation history array
         * @param req - Optional HTTP request object
         * @returns Formatted API response with either:
         * - Success: Chat response data
         * - Error: Failure details
         */
        async handleRequest(
            tool: PolicyTool,
            message: string,
            history?: Message[],
            req?: IncomingMessage
        ): Promise<ApiResponse<ChatResponse>> {
            try {
                if (!message || !handlers.has(tool)) {
                    logger.warn(`Invalid request - Tool: ${tool}, Message: ${!!message}`);
                    return {
                        success: false,
                        error: 'Invalid request parameters'
                    };
                }

                // Check if we can make more requests
                if (req && !(await rateLimiter.canMakeRequest(req))) {
                    logger.warn('Rate limit exceeded for request');
                    return {
                        success: false,
                        error: 'Rate limit exceeded. Please try again later.'
                    };
                }

                const handler = handlers.get(tool)!;
                logger.info(`Processing ${tool} request`);
                
                // Filter out system messages and keep only user-assistant interaction
                const userHistory = history?.filter(msg => 
                    msg.role === 'user' || msg.role === 'assistant'
                ) || [];

                const response = await handler.handleMessage(message, userHistory, req);
                
                return {
                    success: true,
                    data: response
                };

            } catch (error) {
                logger.error('PolicyRouter error', {
                    error: error instanceof Error ? error.message : String(error)
                });
                return {
                    success: false,
                    error: 'Internal server error'
                };
            }
        }
    };
}

// Factory function to create policy router
export function createPolicyRouter(): PolicyRouter {
    logger.info('Creating policy router');
    return createPolicyRouterImpl();
} 
