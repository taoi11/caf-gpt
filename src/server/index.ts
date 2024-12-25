import { createServer } from 'http';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { CONFIG } from './config';
import { handlePaceNoteRequest } from './api/paceNotes/paceNotes';
import { logger } from './logger';

const server = createServer(async (req, res) => {
    const url = req.url || '/';
    const method = req.method || 'GET';

    logger.debug(`Incoming request: ${method} ${url}`);

    // API endpoints
    if (url === '/api/paceNotes/generate') {
        return handlePaceNoteRequest(req, res);
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

const port = CONFIG.server.port;
server.listen(port, () => {
    logger.info(`Server running in ${CONFIG.server.environment} mode on port ${port}`);
    logger.debug('Debug logging enabled');
}); 