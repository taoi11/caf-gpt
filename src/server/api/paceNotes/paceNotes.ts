import { IncomingMessage, ServerResponse } from 'http';
import { paceNoteAgent } from './paceNoteAgent';
import { logger } from '../../logger';
import { rateLimitMiddleware } from '../middleware/rateLimitMiddleware';
import type { PaceNoteRequest, ApiResponse, PaceNoteResponse } from '../../../types';

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

    // Check rate limit
    if (!rateLimitMiddleware(req, res)) {
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

        logger.debug('Generating pace note for input:', request.input.substring(0, 50) + '...');
        const response = await paceNoteAgent.generateNote(request);
        
        const apiResponse: ApiResponse<PaceNoteResponse> = {
            success: true,
            data: response
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(apiResponse));
        logger.logRequest(method, url, 200);
    } catch (error) {
        logger.error('Pace Note generation error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Failed to generate pace note'
        }));
        logger.logRequest(method, url, 500);
    }
} 