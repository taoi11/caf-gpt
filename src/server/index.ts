/**
 * Primary HTTP server with API endpoints and static file serving.
 * Orchestrates request handling, rate limiting, and subsystem integration.
 */
import { createServer } from 'http';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { PORT } from './utils/config';
import { handlePaceNoteRequest } from './api/paceNotes/paceNotes';
import { createPolicyRouter } from './api/policyFoo/policyFoo';
import { logger } from './utils/logger';
import { rateLimiter } from './utils/rateLimiter';
import { costTracker } from './utils/costTracker';
import { quickStartup, getHealthStatus } from './utils/bootup';

// Initialize policy router
const policyRouter = createPolicyRouter();

const server = createServer(async (req, res) => {
    const url = req.url || '/';
    const method = req.method || 'GET';
    // Log incoming request
    logger.debug(`Incoming request: ${method} ${url}`);
    // Pace note endpoint
    if (url === '/api/paceNotes/generate') {
        return handlePaceNoteRequest(req, res);
    }
    // Policy endpoint
    if (url === '/api/policyfoo/doad/generate' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                // Validate conversation history
                const history = Array.isArray(data.conversationHistory) 
                    ? data.conversationHistory.filter((msg: { role?: string; content?: string }) => 
                        msg && typeof msg.role === 'string' && 
                        typeof msg.content === 'string' &&
                        (msg.role === 'user' || msg.role === 'assistant')
                      )
                    : [];
                // Handle policy request
                const response = await policyRouter.handleRequest(
                    data.tool,
                    data.message,
                    history,
                    req
                );
                // Write response
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response));
                // Log request
                logger.logRequest(method, url, 200);
            } catch (error) {
                // Log error
                const err = error instanceof Error ? error : new Error('Unknown error');
                logger.error('Policy request error', {
                    error: err.message,
                    stack: err.stack
                });
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: false, 
                    error: 'Internal server error' 
                }));
                logger.logRequest(method, url, 500);
            }
        });
        return;
    }
    // Rate limit info endpoint
    if (url === '/api/ratelimit') {
        const limits = rateLimiter.getLimitInfo(req);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(limits));
        logger.debug('Rate limit info request', { limits });
        return;
    }
    // Enhanced health check endpoint
    if (url === '/health') {
        const healthStatus = getHealthStatus();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(healthStatus));
        return;
    }
    // Cost endpoint with improved error handling
    if (url === '/api/costs' && method === 'GET') {
        try {
            const costs = costTracker.getCostData();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(costs));
            logger.logRequest(method, url, 200);
            return;
        } catch (error) {
            const err = error instanceof Error ? error : new Error('Unknown error');
            logger.error('Error fetching costs', {
                error: err.message,
                stack: err.stack
            });
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                error: 'Failed to fetch costs',
                message: err.message
            }));
            logger.logRequest(method, url, 500);
            return;
        }
    }
    // Serve static files
    try {
        // Default to index.html for root path
        const filePath = (url === '/' ? '/index.html' : url) as string;
        const fullPath = join(process.cwd(), 'public', filePath);
        const content = await readFile(fullPath);
        // Set content type based on file extension
        const ext = filePath.split('.').pop() || '';
        const contentTypes: Record<string, string> = {
            'html': 'text/html',
            'css': 'text/css',
            'js': 'application/javascript',
            'json': 'application/json',
            'ico': 'image/x-icon'
        };
        res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
        res.end(content);
        logger.logRequest(method, url, 200);
    } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        logger.error('Error serving file', {
            error: err.message,
            stack: err.stack,
            path: url,
            method,
            errorName: err.name
        });
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        logger.logRequest(method, url, 404);
    }
});
// Start the server
server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    // Run quick startup after server is listening
    quickStartup().catch(error => {
        logger.error('Quick startup failed', {
            error: error instanceof Error ? error.message : String(error)
        });
    });
    // Log debug logging enabled
    logger.debug('Debug logging enabled');
}); 
