import { buildEvolutionGroupsUrl } from '../services/WhatsAppGroupService.ts';
import { isInsideWindow } from '../services/AutomationScheduler.ts';

function assert(condition:boolean,message:string){ if(!condition) throw new Error(message); }

const groupsUrl=buildEvolutionGroupsUrl('https://evolution.example.com/','minha_instancia');
const parsed=new URL(groupsUrl);
assert(parsed.pathname==='/group/fetchAllGroups/minha_instancia','Evolution groups endpoint must be canonical');
assert(parsed.searchParams.get('getParticipants')==='true','Evolution groups request must explicitly send getParticipants=true');

const utcDate=new Date('2026-09-20T03:30:00.000Z'); // 00:30 in America/Maceio
assert(isInsideWindow(utcDate,'00:00','01:00','America/Maceio'),'Scheduler must evaluate window in workspace timezone');
assert(!isInsideWindow(utcDate,'01:00','02:00','America/Maceio'),'Scheduler must not use server timezone for business windows');

console.log('Production regressions: PASS');
