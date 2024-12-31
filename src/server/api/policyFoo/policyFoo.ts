import { ApiResponse, Message } from '../utils/types';
import { logger } from '../utils/logger';
import { rateLimiter } from '../utils/rateLimiter';
import { IncomingMessage } from 'http';
import { createDOADHandler } from './doad/doad';
import { ChatResponse } from './doad/types';
import { IS_DEV } from '../utils/config';

// Policy tool types
export type PolicyTool = 'doadFoo';

// Base interfaces
export interface PolicyRequest {
    tool: PolicyTool;
    message: string;
    conversationHistory?: Message[];
}

export interface ResponseFormatter {
    formatResponse(response: ChatResponse): ChatResponse;
    validateRequest(message: string): boolean;
}

export interface PolicyHandler extends ResponseFormatter {
    handleMessage(
        message: string, 
        history?: Message[], 
        req?: IncomingMessage
    ): Promise<ChatResponse>;
}

// Default response formatter implementation
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

// Policy router interface
export interface PolicyRouter {
    handleRequest(
        tool: PolicyTool,
        message: string,
        history?: Message[],
        req?: IncomingMessage
    ): Promise<ApiResponse<ChatResponse>>;
}

// Policy router implementation
interface PolicyRouterImpl extends PolicyRouter {
    handlers: Map<PolicyTool, PolicyHandler>;
}

// Create policy router implementation
function createPolicyRouterImpl(): PolicyRouterImpl {
    const handlers = new Map<PolicyTool, PolicyHandler>([
        ['doadFoo', createDOADHandler()]
    ]);

    return {
        handlers,
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
                logger.error('PolicyRouter error:', error);
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