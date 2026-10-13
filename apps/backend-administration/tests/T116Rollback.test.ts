import {it,expect,vi} from 'vitest';
import type {Pool} from 'pg';
import {AdminWriteSessionCoordinator,NfcTagReassignmentCoordinator} from '../src/index.js';
import {fixtureAccessTokenVerifier,fixtureTokens,membershipIds,ids} from './fixtures.js';
it.each(['reassignment','removal'] as const)('discards the %s client when rollback fails while preserving the original error',async kind=>{
 const original=new Error('operation failed'),rollbackError=new Error('connection terminated');
 const client={query:vi.fn(async(sql:string)=>{if(sql.startsWith('BEGIN'))return {rows:[]};if(sql==='ROLLBACK')throw rollbackError;throw original;}),on:vi.fn(),off:vi.fn(),release:vi.fn()};
 const pool={connect:async()=>client} as unknown as Pool;
 const coordinator=kind==='reassignment'?new NfcTagReassignmentCoordinator(pool,fixtureAccessTokenVerifier):new AdminWriteSessionCoordinator(pool,fixtureAccessTokenVerifier);
 const command={accessToken:fixtureTokens.adminA,expectedMembershipId:membershipIds.adminA,commandId:ids.assignmentA,nfcTagId:ids.tagAssignedA,expectedAssignmentId:ids.assignmentA};
 const operation=kind==='removal'?(coordinator as AdminWriteSessionCoordinator).removeTag(command):(coordinator as unknown as {runWithAuthority:Function}).runWithAuthority(command.accessToken,command.expectedMembershipId,command.commandId,{},async()=>({disposition:'commit',value:{}}));
 await expect(operation).rejects.toBe(original);expect(client.release).toHaveBeenCalledWith(rollbackError);
});
