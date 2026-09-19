import { query } from './database.ts';

export async function ensureWorkspace(workspaceId = 'ws_default') {
  await query(
    'INSERT INTO workspaces(id,name) VALUES($1,$2) ON CONFLICT (id) DO NOTHING',
    [workspaceId, 'WhatsApp Afiliado']
  );
}
