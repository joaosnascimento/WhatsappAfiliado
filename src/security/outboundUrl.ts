import dns from 'node:dns/promises';
import net from 'node:net';

function isPrivateIp(address:string):boolean {
  if (net.isIPv4(address)) {
    const [a,b]=address.split('.').map(Number);
    return a===10 || a===127 || a===0 || (a===169&&b===254) || (a===172&&b>=16&&b<=31) || (a===192&&b===168) || a>=224;
  }
  if (net.isIPv6(address)) {
    const v=address.toLowerCase();
    if (v.startsWith('::ffff:') && isPrivateIp(v.slice(7))) return true;
    return v==='::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80:') || v==='::';
  }
  return true;
}

export async function assertSafeOutboundUrl(raw:string, options:{allowHttpLocalhost?:boolean}={}) {
  let u:URL;
  try { u=new URL(raw); } catch { throw new Error('URL inválida.'); }
  const local=u.hostname==='localhost' || u.hostname.endsWith('.localhost');
  if (u.username || u.password || u.hash || u.search) throw new Error('URL de saída contém componentes não permitidos.');
  if (u.protocol!=='https:' && !(options.allowHttpLocalhost && u.protocol==='http:' && local)) throw new Error('Somente URLs HTTPS são permitidas.');
  if (local || net.isIP(u.hostname) && isPrivateIp(u.hostname)) throw new Error('Destino de rede privada não permitido.');
  const records=await dns.lookup(u.hostname,{all:true});
  if (!records.length || records.some(r=>isPrivateIp(r.address))) throw new Error('Destino resolve para rede privada e foi bloqueado.');
  return u;
}
