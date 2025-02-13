import { createServer } from 'http';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { PORT, IS_DEV } from './server/utils/config.js';
import { handlePaceNoteRequest } from './server/api/paceNotes/paceNotes.js';
import { createPolicyRouter } from './server/api/policyFoo/policyFoo.js';
import { logger } from './server/utils/logger.js';
import { rateLimiter } from './server/utils/rateLimiter.js';
import { costTracker } from './server/utils/costTracker.js';
import { randomBytes } from 'crypto';
import { parse, serialize } from 'cookie';

// Initialize policy router
const policyRouter = createPolicyRouter();

// Middleware to set the CSRF token on initial page load
function setCSRFToken(req: any, res: any, next: any) {
    if (req.url === '/' || req.url.endsWith('.html')) { // Apply to your HTML pages
        const csrfToken = randomBytes(32).toString('hex');
        res.setHeader('Set-Cookie', serialize('csrfToken', csrfToken, {
            httpOnly: true, // Important for security
            secure: !IS_DEV, // Only send over HTTPS in production
            sameSite: 'Strict', // Recommended for CSRF protection
            path: '/',
        }));
        // Attach the token to the response so the frontend can read it
        res.locals.csrfToken = csrfToken;
    }
    next();
}

// Middleware to validate the CSRF token on API requests
function validateCSRFToken(req: any, res: any, next: any) {
    if (req.method === 'GET' || req.url === '/health' || req.url === '/api/costs' || req.url === '/api/ratelimit') {
        return next(); // Skip CSRF check for GET requests
    }

    const csrfTokenHeader = req.headers['x-csrf-token'];
    const cookies = parse(req.headers.cookie || '');
    const csrfTokenCookie = cookies.csrfToken;

    if (!csrfTokenHeader || !csrfTokenCookie || csrfTokenHeader !== csrfTokenCookie) {
        logger.warn('CSRF token validation failed');
        return res.status(403).send('CSRF token validation failed');
    }

    next();
}

const server = createServer(async (req, res) => {
    const url = req.url || '/';
    const method = req.method || 'GET';

    logger.debug(`Incoming request: ${method} ${url}`);

    // Apply CSRF protection middleware
    setCSRFToken(req, res, () => {
        validateCSRFToken(req, res, async () => {

            // API endpoints
            if (url === '/api/paceNotes/generate') {
                return handlePaceNoteRequest(req, res);
            }

            if (url === '/api/policyfoo/doad/generate' && method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                    try {
                        const data = JSON.parse(body);
                        
                        // Validate conversation history
                        const history = Array.isArray(data.conversationHistory) 
                            ? data.conversationHistory.filter((msg: any) => 
                                msg && typeof msg.role === 'string' && 
                                typeof msg.content === 'string' &&
                                (msg.role === 'user' || msg.role === 'assistant')
                              )
                            : [];

                        const response = await policyRouter.handleRequest(
                            data.tool,
                            data.message,
                            history,
                            req
                        );
                        
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(response));
                        logger.logRequest(method, url, 200);
                    } catch (error) {
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

            // Health check endpoint
            if (url === '/health') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok' }));
                return;
            }

            // Cost endpoint
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
                    res.end(JSON.stringify({ error: 'Failed to fetch costs' }));
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
    });
});

server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.debug('Debug logging enabled');
});
