function parseTime(value:string,fallback:number){const match=/^(\d{2}):(\d{2})$/.exec(value||'');if(!match)return fallback;return Number(match[1])*60+Number(match[2]);}
export function zonedMinutes(now:Date,timezone:string):{minutes:number;dateKey:string}{
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,hour:'2-digit',minute:'2-digit',year:'numeric',month:'2-digit',day:'2-digit',hourCycle:'h23'}).formatToParts(now);
  const get=(type:string)=>parts.find(p=>p.type===type)?.value||'00';
  return {minutes:Number(get('hour'))*60+Number(get('minute')),dateKey:`${get('year')}-${get('month')}-${get('day')}`};
}
export function isInsideWindow(now:Date,start:string,end:string,timezone:string){
  const current=zonedMinutes(now,timezone).minutes; const from=parseTime(start,0); const to=parseTime(end,23*60+59);
  return from<=to ? current>=from&&current<=to : current>=from||current<=to;
}