import { createServer } from 'http';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { PORT, IS_DEV } from './utils/config.js';
import { handlePaceNoteRequest } from './api/paceNotes/paceNotes.js';
import { createPolicyRouter } from './api/policyFoo/policyFoo.js';
import { logger } from './utils/logger.js';
import { rateLimiter } from './utils/rateLimiter.js';
import { costTracker } from './utils/costTracker.js';

// Initialize policy router
const policyRouter = createPolicyRouter();

const server = createServer(async (req, res) => {
    const url = req.url || '/';
    const method = req.method || 'GET';

    logger.debug(`Incoming request: ${method} ${url}`);

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
                logger.error(err, 'Policy request error');
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
        const ip = req.socket.remoteAddress || '0.0.0.0';
        const limits = rateLimiter.getLimitInfo(ip);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(limits));
        return;
    }

    // IP info endpoint
    if (url === '/api/ratelimit/ip-info') {
        const ip = req.socket.remoteAddress || '0.0.0.0';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            isIPv6: ip.includes(':') && !ip.startsWith('::ffff:')
        }));
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
            logger.error(err, 'Error fetching costs');
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
        logger.error(err, `Error serving ${url}`, {
            path: url,
            method,
            errorName: err.name
        });
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        logger.logRequest(method, url, 404);
    }
});

server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.debug('Debug logging enabled');
}); 