import { IncomingMessage, ServerResponse } from 'http';
import { paceNoteAgent } from './paceNoteAgent.js';
import { logger } from '../../utils/logger.js';
import { rateLimiter } from '../../utils/rateLimiter.js';
import type { ApiResponse, PaceNoteRequest, PaceNoteResponse } from '../../utils/types.js';

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