import { IncomingMessage, ServerResponse } from 'http';
import { rateLimiter } from '../utils/rateLimiter';
import { logger } from '../../logger';

export function rateLimitMiddleware(req: IncomingMessage, res: ServerResponse): boolean {
    // Get client IP
    const ip = req.socket.remoteAddress || '0.0.0.0';
    
    // Check rate limit
    if (!rateLimiter.checkLimit(ip)) {
        logger.warn(`Rate limit exceeded for IP: ${ip}`);
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Rate limit exceeded. Please try again later.'
        }));
        return false;
    }
    
    return true;
} 