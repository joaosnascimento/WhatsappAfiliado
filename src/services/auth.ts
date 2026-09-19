import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { query } from '../infrastructure/database.ts';

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

function secret() {
  if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is required.');
  if (process.env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters.');
  return process.env.SESSION_SECRET;
}
function sign(value: string) { return createHmac('sha256', secret()).update(value).digest('base64url'); }
function token(workspaceId: string, userId: string) {
  const payload = Buffer.from(JSON.stringify({ workspaceId, userId, exp: Date.now() + TTL_MS, nonce: randomBytes(8).toString('hex') })).toString('base64url');
  return payload + '.' + sign(payload);
}
export function verifySession(value: string) {
  try {
    const [payload, signature] = value.split('.');
    if (!payload || !signature) return null;
    const expected = sign(payload);
    if (expected.length !== signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {workspaceId:string;userId:string;exp:number};
    if (!data.workspaceId || !data.userId || !Number.isFinite(data.exp)) return null;
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}
export async function registerUser(email: string, password: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10 || password.length > 128) throw new Error('Credenciais inválidas.');
  const hash = await bcrypt.hash(password, 12);
  const id = 'usr_' + randomBytes(12).toString('hex');
  const workspaceId = 'ws_' + randomBytes(12).toString('hex');
  try {
    await query('INSERT INTO workspaces(id,name) VALUES($1,$2)',[workspaceId,'Workspace de ' + email.toLowerCase()]);
    await query('INSERT INTO users(id,workspace_id,email,password_hash) VALUES($1,$2,$3,$4)',[id,workspaceId,email.toLowerCase(),hash]);
  } catch { throw new Error('Não foi possível criar a conta.'); }
  return { id, workspaceId };
}
export async function authenticateUser(email: string, password: string) {
  const rows = await query<{id:string;workspace_id:string;password_hash:string}>('SELECT id,workspace_id,password_hash FROM users WHERE email=$1',[email.toLowerCase()]);
  if (!rows[0] || !(await bcrypt.compare(password, rows[0].password_hash))) return null;
  return { id: rows[0].id, workspaceId: rows[0].workspace_id };
}
export function createSession(user: {id:string;workspaceId:string}) { return token(user.workspaceId, user.id); }
