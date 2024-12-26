import { createServer } from 'http';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { PORT } from './config';
import { handlePaceNoteRequest } from './api/paceNotes/paceNotes';
import { costTracker } from './api/utils/costTracker';
import { logger } from './logger';
import { rateLimiter } from './api/utils/rateLimiter';

const server = createServer(async (req, res) => {
    const url = req.url || '/';
    const method = req.method || 'GET';

    logger.debug(`Incoming request: ${method} ${url}`);

    // API endpoints
    if (url === '/api/paceNotes/generate') {
        return handlePaceNoteRequest(req, res);
    }

    // Cost endpoint
    if (url === '/api/costs') {
        const costs = {
            apiCosts: costTracker.getMonthlyAPITotal(),
            serverCosts: costTracker.getMonthlyServerCost(),
            lastUpdated: costTracker.getLastUpdated()
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(costs));
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
            'js': 'text/javascript',
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