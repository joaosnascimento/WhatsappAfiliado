import type { Request, Response, NextFunction } from 'express';
import { verifySession } from './auth.ts';
import { runWithWorkspace } from './Store.ts';
import { recordSecurityEvent } from '../security/security.ts';

declare global { namespace Express { interface Request { user?: { userId:string; workspaceId:string } } } }

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.get('authorization');
  const value = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  let session = null;
  try { session = value ? await verifySession(value) : null; }
  catch (error) { console.error('Session verification error:', error); return res.status(503).json({ error:'Serviço de autenticação temporariamente indisponível.' }); }
  if (!session) { void recordSecurityEvent({eventType:'AUTH_FAILURE',severity:'MEDIUM',ip:req.ip,userAgent:req.get('user-agent')||undefined,path:req.path}); return res.status(401).json({ error: 'Autenticação necessária.' }); }

  req.user = { userId: session.userId, workspaceId: session.workspaceId };
  void runWithWorkspace(session.workspaceId, () => next()).catch((error) => {
    console.error('Workspace initialization error:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Não foi possível inicializar o workspace.' });
  });
}
