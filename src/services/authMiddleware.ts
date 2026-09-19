import type { Request, Response, NextFunction } from 'express';
import { verifySession } from './auth.ts';
import { runWithWorkspace } from './Store.ts';

declare global { namespace Express { interface Request { user?: { userId:string; workspaceId:string } } } }

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.get('authorization');
  const value = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  const session = value ? verifySession(value) : null;
  if (!session) return res.status(401).json({ error: 'Autenticação necessária.' });

  req.user = { userId: session.userId, workspaceId: session.workspaceId };
  void runWithWorkspace(session.workspaceId, () => next()).catch((error) => {
    console.error('Workspace initialization error:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Não foi possível inicializar o workspace.' });
  });
}
