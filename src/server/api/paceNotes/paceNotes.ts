/**
 * Pace Notes API handler that processes incoming requests for generating
 * standardized performance notes for CAF Members. Handles validation,
 * rate limiting, and error handling for the pace notes generation process.
 * Orchestrates the interaction between the HTTP layer and the PaceNoteAgent.
 */
import { IncomingMessage, ServerResponse } from 'http';
import { paceNoteAgent } from './paceNoteAgent';
import { logger } from '../../utils/logger';
import { rateLimiter } from '../../utils/rateLimiter';
import type { PaceNoteRequest } from '../../types';
// These types are used indirectly in the function
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { ApiResponse, PaceNoteResponse } from '../../types';

/**
 * Handles incoming pace note generation requests with full lifecycle management
 * @param req - Incoming HTTP request containing user input and rank selection
 * @param res - Server response object for sending generated notes or errors
 * @returns Promise resolving when request processing completes
 */
export async function handlePaceNoteRequest(req: IncomingMessage, res: ServerResponse) {
    const method = req.method || 'GET';
    const url = req.url || '/';

    if (req.method !== 'POST') {
        logger.warn(`Method ${method} not allowed for ${url}`);
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
        logger.logRequest(method, url, 405);
        return;
    }

    // Check if request can be made
    if (!(await rateLimiter.canMakeRequest(req))) {
        const limits = rateLimiter.getLimitInfo(req);
        if (limits.hourly.remaining === 0) {
            rateLimiter.sendLimitResponse(req, res, 'hourly');
        } else {
            rateLimiter.sendLimitResponse(req, res, 'daily');
        }
        logger.logRequest(method, url, 429);
        return;
    }

    try {
        // Read request body
        let body = '';
        for await (const chunk of req) {
            body += chunk;
        }
        
        const request: PaceNoteRequest = JSON.parse(body);
        if (!request.input?.trim()) {
            logger.warn('Empty input received');
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: 'Input text is required'
            }));
            logger.logRequest(method, url, 400);
            return;
        }

        logger.debug('Generating pace note for input', { 
            input: request.input.substring(0, 50) + '...' 
        });
        const response = await paceNoteAgent.generateNote(request);
        
        // Track the request only ONCE after successful completion
        await rateLimiter.trackSuccessfulRequest(req);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            data: response
        }));
        logger.logRequest(method, url, 200);
    } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        logger.error('Pace Note generation error', {
            error: err.message,
            stack: err.stack
        });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Failed to generate pace note'
        }));
        logger.logRequest(method, url, 500);
    }
} 
