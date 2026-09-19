import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { query } from '../infrastructure/database.ts';

export function requestSecurityMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = randomUUID();
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('Cache-Control', req.path.startsWith('/api/') ? 'no-store' : 'no-cache');
  req.setTimeout(Number(process.env.REQUEST_TIMEOUT_MS || 30000));
  res.setTimeout(Number(process.env.REQUEST_TIMEOUT_MS || 30000));
  next();
}

export function securityHeaders(res: Response, production: boolean) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' https:; font-src 'self' data: https:");
  if (production) res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
}

export async function recordSecurityEvent(params:{workspaceId?:string;userId?:string;eventType:string;severity?:'LOW'|'MEDIUM'|'HIGH'|'CRITICAL';ip?:string;userAgent?:string;path?:string;metadata?:Record<string,unknown>}) {
  if (!process.env.DATABASE_URL) return;
  try {
    await query(
      `INSERT INTO security_events(id,workspace_id,user_id,event_type,severity,ip_address,user_agent,path,metadata)
       VALUES(gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8)`,
      [params.workspaceId || null, params.userId || null, params.eventType, params.severity || 'LOW', params.ip || null, params.userAgent || null, params.path || null, JSON.stringify(params.metadata || {})]
    );
  } catch (error) {
    console.error('Security event persistence failed:', error);
  }
}

export function safeInternalError(res: Response, status=500) {
  return res.status(status).json({ error: 'Não foi possível processar a solicitação.' });
}
