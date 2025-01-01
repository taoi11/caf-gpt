import { createServer } from 'http';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { PORT, IS_DEV } from './utils/config.js';
import { handlePaceNoteRequest } from './api/paceNotes/paceNotes.js';
import { createPolicyRouter } from './api/policyFoo/policyFoo.js';
import { logger } from './utils/logger.js';
import { rateLimiter } from './utils/rateLimiter.js';

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
                logger.error('Policy request error:', error);
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

    // Serve static files
    try {
        // Default to index.html for root path
        const filePath = url === '/' ? '/index.html' : url;
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
        logger.error(`Error serving ${url}:`, error);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        logger.logRequest(method, url, 404);
    }
});

server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.debug('Debug logging enabled');
}); 