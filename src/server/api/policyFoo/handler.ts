import { IncomingMessage, ServerResponse } from 'http';
import { logger } from '../../logger';
import { rateLimiter } from '../utils/rateLimiter';
import { policyAgent } from './policyAgent';

export async function handlePolicyFooRequest(req: IncomingMessage, res: ServerResponse) {
    if (!rateLimiter.canMakeRequest(req)) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
        return;
    }

    try {
        const body = await new Promise<string>((resolve) => {
            let data = '';
            req.on('data', chunk => data += chunk);
            req.on('end', () => resolve(data));
        });

        const { content } = JSON.parse(body);
        if (!content) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No content provided' }));
            return;
        }

        const response = await policyAgent.process(content);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));

    } catch (error) {
        logger.error('Error in policy request:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
    }
} 