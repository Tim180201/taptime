import { createRenameCapability, renameSelf, renameEmployee } from './T126Capability';
export async function createPayrollCapability(role: 'administrator' | 'standortleitung' = 'administrator') {
  const cap = await createRenameCapability(role);
  const numbers = new Map<string, string | null>([[renameSelf,null],[renameEmployee,'0002']]);
  const commands: {commandId:string; id:string|null; version:number; value:string|null}[] = [];
  let workWageType: string | null = null, wageVersion = 1;
  const api = Object.assign(cap.api, {
    readMembershipPayroll: async (_token:string,_actor:string,id:string) => ({status:'succeeded' as const,
      value:{personnelNumber:numbers.get(id)??null,rowVersion:cap.people.find(p=>p.id===id)!.rowVersion}}),
    readPayrollSettings: async () => ({status:'succeeded' as const,value:{workWageType,rowVersion:wageVersion,missingPersonnelNumberCount:[...numbers.values()].filter(v=>v===null).length}}),
    setPersonnelNumber: async (_token:string,_actor:string,commandId:string,id:string,version:number,value:string|null) => {
      commands.push({commandId,id,version,value}); numbers.set(id,value); const person=cap.people.find(p=>p.id===id)!;person.rowVersion++;
      return {status:'succeeded' as const,value:true as const};
    },
    setWorkWageType: async (_token:string,_actor:string,commandId:string,version:number,value:string|null) => {
      commands.push({commandId,id:null,version,value});workWageType=value;wageVersion++;
      return {status:'succeeded' as const,value:true as const};
    },
  });
  return {...cap,api,numbers,payrollCommands:commands};
}
