import type { Request, Response, NextFunction } from 'express';
import { redis } from '../infrastructure/redis.ts';
import { recordSecurityEvent } from '../security/security.ts';

export function redisRateLimit(options: {
  windowSeconds: number;
  max: number;
  prefix: string;
  key?: (req: Request) => string;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!redis) {
      if (process.env.NODE_ENV === 'production') {
        return res.status(503).json({ error: 'Rate limiting indisponível: REDIS_URL é obrigatório em produção.' });
      }
      return next();
    }

    const identity = options.key?.(req) || req.user?.userId || req.ip || 'unknown';
    const key = `ratelimit:${options.prefix}:${identity}`;
    try {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, options.windowSeconds);
      res.setHeader('X-RateLimit-Limit', options.max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, options.max - count));
      if (count > options.max) {
        const ttl = await redis.ttl(key);
        res.setHeader('Retry-After', Math.max(1, ttl));
        void recordSecurityEvent({eventType:'RATE_LIMIT_EXCEEDED',severity:'MEDIUM',workspaceId:req.user?.workspaceId,userId:req.user?.userId,ip:req.ip,userAgent:req.get('user-agent')||undefined,path:req.path,metadata:{prefix:options.prefix,limit:options.max}});
        return res.status(429).json({ error: 'Muitas solicitações. Tente novamente mais tarde.' });
      }
      return next();
    } catch (error) {
      console.error('Rate limit error:', error);
      return process.env.NODE_ENV === 'production'
        ? res.status(503).json({ error: 'Rate limiting indisponível.' })
        : next();
    }
  };
}
