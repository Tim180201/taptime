import { execFile } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { Pool } from 'pg';
import { expect, it } from 'vitest';
import { migrate } from '@taptime/backend-schema';
import type { AccessTokenVerifier } from '@taptime/backend-identity';
import { encodeRestoreEvidenceV1 } from '@taptime/offline-sync-contract';
import type { OfflineCaptureLeasePage, OfflineLifecycleEventCommand } from '@taptime/offline-sync-contract';
import { OfflineCaptureLeaseCoordinator, OfflineLifecycleIngestionCoordinator } from '../src/index.js';

const execute = promisify(execFile);
const image = 'postgres:17.10-bookworm';
const fixture = () => Object.fromEntries(['user','binding','organization','membership','customer','tag','assignment']
  .map(key => [key,randomUUID()])) as Record<string,string>;
const a = fixture(), b = fixture(), colleague = fixture();
const binding = Buffer.alloc(32,11).toString('base64url');
const verifier: AccessTokenVerifier = { async verify(token) { return { status: 'verified', identity: {
  issuer: 't055b', subject: token } }; } };
const ingest = (pool: Pool, command: OfflineLifecycleEventCommand, token = 'a') =>
  new OfflineLifecycleIngestionCoordinator(pool,verifier).ingest({ accessToken: token,command });
async function recover(pool: Pool, operationId: string, command: OfflineLifecycleEventCommand,
  localState: 'confirmed'|'pending' = 'confirmed', token = 'a') {
  const coordinator = new OfflineLifecycleIngestionCoordinator(pool,verifier);
  return coordinator.recover({ accessToken: token,
    command: { contractVersion: 1,operationId,localState,evidence: command } });
}
function command(f: Record<string,string>, lease: OfflineCaptureLeasePage, sequence: number, delta: number,
  installationBinding = binding): OfflineLifecycleEventCommand {
  return { organizationId: f.organization!,expectedMembershipId: f.membership!,leaseId: lease.leaseId,
    leaseItemId: lease.items[0]!.itemId,installationBinding,deviceSequence: sequence,provenanceVersion: 1,
    clock: { bootMarker: 't055b',monotonicAnchorMilliseconds: 1000,monotonicDeltaMilliseconds: delta,
      wallClockAnchor: lease.issuedAt,clockProofStatus: 'verified_same_boot',clockProofVersion: 1 },
    workEvent: { id: randomUUID(),assignmentId: f.assignment!,nfcTagId: f.tag!,
      target: { targetType: 'customer',targetId: f.customer! },occurredAt: new Date(Date.parse(lease.issuedAt)+delta).toISOString() },
    receipt: { id: randomUUID(),attemptNumber: 1 } };
}

it('retains lost decisions and origins after physical disk loss, isolates actors and preserves the sequence', async () => {
  const prefix = `taptime-t055b-${randomUUID()}`;
  const containers: string[] = [], volumes: string[] = [], pools: Pool[] = [];
  async function docker(...args: string[]) {
    if (args[0] === 'run') args.splice(1,0,'--pull=never');
    return (await execute('docker',args,{maxBuffer:16*1024*1024})).stdout.trim();
  }
  async function volume(suffix: string) { const name = `${prefix}-${suffix}`;
    await docker('volume','create',name); volumes.push(name); return name; }
  async function connect(container: string) {
    const port = (await docker('port',container,'5432/tcp')).split(':').at(-1);
    const pool = new Pool({connectionString:`postgresql://postgres@127.0.0.1:${port}/postgres`}); pools.push(pool);
    await expect.poll(async () => { try { return (await pool.query('SELECT NOT pg_is_in_recovery() AS ready')).rows[0].ready; }
      catch { return false; } },{timeout:60000,interval:200}).toBe(true); return pool;
  }
  async function issue(pool: Pool, token = 'a', installationBinding = binding) {
    const result = await new OfflineCaptureLeaseCoordinator(pool,verifier).issue({ accessToken: token,
      command: { commandId: randomUUID(),installationBinding,lookupKey: Buffer.alloc(32,12).toString('base64url') } });
    if (result.status !== 'ready') throw Error(result.status); return result.page;
  }
  try {
    const data = await volume('data'), base = await volume('base'), wal = await volume('wal');
    await docker('run','--rm','--network','none','-v',`${base}:/base`,'-v',`${wal}:/archive`,image,
      'chown','-R','postgres:postgres','/base','/archive');
    const source = `${prefix}-source`; containers.push(source);
    await docker('run','-d','--name',source,'-p','127.0.0.1::5432','-e','POSTGRES_HOST_AUTH_METHOD=trust',
      '-v',`${data}:/var/lib/postgresql/data`,'-v',`${base}:/base`,'-v',`${wal}:/archive`,image,'postgres',
      '-c','wal_level=replica','-c','archive_mode=on','-c','archive_command=test ! -f /archive/%f && cp %p /archive/%f');
    const original = await connect(source); await migrate(original);
    for (const [token,f] of [['a',a],['b',b]] as const) await original.query(`
      INSERT INTO taptime_server.users(id) VALUES($1);
    `,[f.user]);
    for (const [token,f] of [['a',a],['b',b]] as const) {
      await original.query('INSERT INTO taptime_server.identity_bindings(id,user_id,issuer,subject) VALUES($1,$2,$3,$4)',[f.binding,f.user,'t055b',token]);
      await original.query('INSERT INTO taptime_server.organizations(id,name) VALUES($1,$2)',[f.organization,`Recovery ${token}`]);
      await original.query("INSERT INTO taptime_server.memberships(id,organization_id,user_id,role,created_by_user_id) VALUES($1,$2,$3,'employee',$3)",[f.membership,f.organization,f.user]);
      await original.query("INSERT INTO taptime_server.customers(id,organization_id,display_name,active,activated_at) VALUES($1,$2,'Fixture',true,now())",[f.customer,f.organization]);
      await original.query("INSERT INTO taptime_server.nfc_tags(id,organization_id,display_name,payload_value) VALUES($1,$2,'Fixture','nfc:uid:v1:04AABBCC')",[f.tag,f.organization]);
      await original.query("INSERT INTO taptime_server.nfc_assignments(id,organization_id,nfc_tag_id,target_type,target_customer_id,active,valid_from) VALUES($1,$2,$3,'customer',$4,true,now())",[f.assignment,f.organization,f.tag,f.customer]);
    }
    await original.query('INSERT INTO taptime_server.users(id) VALUES($1)',[colleague.user]);
    await original.query('INSERT INTO taptime_server.identity_bindings(id,user_id,issuer,subject) VALUES($1,$2,$3,$4)',[colleague.binding,colleague.user,'t055b','colleague']);
    await original.query("INSERT INTO taptime_server.memberships(id,organization_id,user_id,role,created_by_user_id) VALUES($1,$2,$3,'employee',$3)",[colleague.membership,a.organization,colleague.user]);
    const lease = await issue(original), otherLease = await issue(original,'b',Buffer.alloc(32,14).toString('base64url'));
    const first = command(a,lease,1,0);
    const known = await ingest(original,first);
    expect(known).toMatchObject({status:'synchronized',decision:{status:'time_entry_started'}});
    await docker('exec','-u','postgres',source,'pg_basebackup','-D','/base','-Fp','-Xs','-c','fast');
    await docker('exec','-u','postgres',source,'pg_verifybackup','/base');
    await original.query("SELECT pg_logical_emit_message(true,'t055b','archive cut')");
    const requiredWal = (await original.query('SELECT pg_walfile_name(pg_current_wal_lsn()) AS file')).rows[0].file;
    await original.query('SELECT pg_switch_wal()');
    await expect.poll(async () => { try { await docker('exec',source,'test','-f',`/archive/${requiredWal}`); return true; }
      catch { return false; } },{timeout:60000,interval:200}).toBe(true);
    await original.query("ALTER SYSTEM SET archive_command='false'"); await original.query('SELECT pg_reload_conf()');
    const second = command(a,lease,2,6000);
    expect(await ingest(original,second)).toMatchObject({status:'synchronized',decision:{status:'time_entry_stopped'}});
    const lostLease = await issue(original);
    const third = command(a,lostLease,3,12000);
    expect(await ingest(original,third)).toMatchObject({status:'synchronized',decision:{status:'time_entry_started'}});
    const lostBinding = Buffer.alloc(32,13).toString('base64url');
    const lostInstallationLease = await issue(original,'a',lostBinding);
    const lostInstallation = command(a,lostInstallationLease,1,0,lostBinding);
    let dump = '';
    try { dump = await docker('exec',source,'pg_waldump','-p','/archive',requiredWal); }
    catch (error) { dump = (error as {stdout:string}).stdout; }
    const lsn = [...dump.matchAll(/lsn: ([0-9A-F]+\/[0-9A-F]+)/g)].at(-1)![1];
    await original.end(); pools.splice(pools.indexOf(original),1);
    await docker('kill','--signal','KILL',source); await docker('rm',source);
    await docker('volume','rm',data); volumes.splice(volumes.indexOf(data),1);
    const restored = await volume('restored'), recoveryArchive = await volume('recovery-archive');
    await docker('run','--rm','--network','none','-v',`${base}:/base:ro`,'-v',`${restored}:/restore`,image,'sh','-c',
      `cp -a /base/. /restore/ && printf "%s\\n" "restore_command = 'cp /archive/%f %p'" "recovery_target_lsn = '${lsn}'" "recovery_target_action = 'promote'" >> /restore/postgresql.auto.conf && touch /restore/recovery.signal && chown -R postgres:postgres /restore`);
    const name = `${prefix}-restored`; containers.push(name);
    await docker('run','-d','--name',name,'-p','127.0.0.1::5432','-v',`${restored}:/var/lib/postgresql/data`,'-v',`${wal}:/archive:ro`,'-v',`${recoveryArchive}:/recovery-archive`,image);
    const pool = await connect(name);
    expect((await pool.query('SELECT id FROM taptime_server.work_events')).rows).toEqual([{id:first.workEvent.id}]);
    expect((await pool.query('SELECT id FROM taptime_server.offline_capture_leases WHERE id=$1',[lostLease.leaseId])).rows).toEqual([]);
    // Test commands deliberately span the scan bounce window; activation must be later than their capture.
    await new Promise(resolve => setTimeout(resolve,Math.max(0,Date.parse(third.workEvent.occurredAt)-Date.now()+10)));
    const operationId = randomUUID();
    expect(await recover(pool,operationId,second)).toEqual({status:'recovery_rejected',reason:'operation_unavailable'});
    // The activator's function independently checks these values against the real restored cluster.
    const evidence = (await pool.query(`SELECT lpad(to_hex(system_identifier),16,'0') AS cluster,
      (SELECT timeline_id FROM pg_control_checkpoint()) AS timeline,pg_last_wal_replay_lsn() AS lsn,
      pg_last_xact_replay_timestamp() AS replayed FROM pg_control_system()`)).rows[0];
    const activator = await pool.connect();
    try { await activator.query('BEGIN'); await activator.query('SET LOCAL ROLE taptime_restore_activator');
      await activator.query("SELECT taptime_server.record_restore_recovery_v1($1,$2,$3,'latest',NULL,$4,$5)",
        [operationId,evidence.cluster,evidence.timeline,evidence.lsn,evidence.replayed]); await activator.query('COMMIT');
    } finally { activator.release(); }
    await docker('exec',name,'chown','postgres:postgres','/recovery-archive');
    await docker('exec','-u','postgres',name,'pg_basebackup','-D','/recovery-archive/base','-Fp','-Xs','-c','fast');
    await docker('exec','-u','postgres',name,'pg_verifybackup','/recovery-archive/base');
    async function lifecycle(sql: string, values: unknown[]) {
      const client = await pool.connect();
      try { await client.query('BEGIN'); await client.query('SET LOCAL ROLE taptime_server_lifecycle');
        await client.query("SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),set_config('app.membership_id',$3,true),set_config('app.membership_role','employee',true)",[a.organization,a.user,a.membership]);
        const result = await client.query(sql,values); await client.query('COMMIT'); return result.rows[0].value;
      } finally { client.release(); }
    }
    const timeEntryId = (await pool.query('SELECT id FROM taptime_server.time_entries WHERE user_id=$1',[a.user])).rows[0].id;
    const capability = await lifecycle('SELECT taptime_server.issue_lock_screen_capability_v1($1,NULL) AS value',[timeEntryId]);
    expect(capability.status).toBe('issued');
    const originalLeases = (await pool.query('SELECT id FROM taptime_server.offline_capture_leases ORDER BY id')).rows;
    const originalInstallations = (await pool.query('SELECT id FROM taptime_server.offline_installations ORDER BY id')).rows;
    expect(await recover(pool,operationId,{...second,workEvent:{...second.workEvent,occurredAt:new Date(Date.now()+60000).toISOString()}}))
      .toEqual({status:'recovery_rejected',reason:'capture_after_activation'});
    expect(await recover(pool,operationId,second,'confirmed','missing')).toEqual({status:'authority_rejected'});
    expect(await recover(pool,operationId,{...second,organizationId:b.organization!,expectedMembershipId:b.membership!},'confirmed','b'))
      .toMatchObject({status:'conflict'});
    expect(await recover(pool,operationId,{...second,expectedMembershipId:colleague.membership!},'confirmed','colleague'))
      .toMatchObject({status:'conflict'});
    for (const tampered of [
      {...second,leaseId:otherLease.leaseId}, {...second,leaseItemId:otherLease.items[0]!.itemId},
      {...second,workEvent:{...second.workEvent,target:{targetType:'customer' as const,targetId:b.customer!}}},
      {...second,leaseItemId:first.receipt.id,leaseId:otherLease.leaseId},
      {...second,workEvent:{...second.workEvent,id:first.workEvent.id}},
    ]) expect(await recover(pool,operationId,tampered)).toMatchObject({status:'conflict'});
    const replayKnown = await recover(pool,operationId,first);
    expect.soft(replayKnown).toMatchObject({status:'synchronized',decision:known.status==='synchronized'?known.decision:undefined});
    const lostDecision = await recover(pool,operationId,second);
    expect.soft(lostDecision).toMatchObject({status:'recovery_pending',reason:'decision_lost',archiveStatus:'archive_pending'});
    if (lostDecision.status !== 'recovery_pending') throw Error('Recovery envelope missing');
    expect(await recover(pool,operationId,second)).toEqual({...lostDecision,idempotentRetry:true});
    // Request hashes normalize to milliseconds; the retained envelope must still match exactly.
    expect.soft(await recover(pool,operationId,{...second,workEvent:{...second.workEvent,
      occurredAt:second.workEvent.occurredAt.replace('Z','001Z')}})).toMatchObject({status:'conflict'});
    expect(await recover(pool,operationId,{...second,clock:{...second.clock,bootMarker:'tampered'}})).toMatchObject({status:'conflict'});
    expect(await ingest(pool,second)).toMatchObject({status:'conflict'});
    expect(await lifecycle('SELECT taptime_server.issue_lock_screen_capability_v1($1,NULL) AS value',[timeEntryId]))
      .toEqual({status:'unauthorized'});
    expect(await lifecycle('SELECT taptime_server.perform_lock_screen_action_v1($1,$2,$3) AS value',
      [createHash('sha256').update(Buffer.from(capability.capability,'base64url')).digest(),'pause',randomUUID()])).toEqual({status:'unauthorized'});
    const lostOrigin = await recover(pool,operationId,third);
    expect.soft(lostOrigin).toMatchObject({status:'recovery_pending',reason:'origin_lost'});
    expect.soft(await recover(pool,operationId,lostInstallation,'pending')).toMatchObject({status:'recovery_pending',reason:'origin_lost'});
    const following = command(a,lease,4,6000);
    expect.soft(await ingest(pool,following)).toMatchObject({status:'review_pending',reason:'predecessor_requires_review'});
    expect.soft(await recover(pool,operationId,command(b,otherLease,1,0,Buffer.alloc(32,14).toString('base64url')),'pending','b'))
      .toMatchObject({status:'synchronized',decision:{status:'time_entry_started'}});
    expect((await pool.query('SELECT id FROM taptime_server.offline_capture_leases ORDER BY id')).rows).toEqual(originalLeases);
    expect((await pool.query('SELECT id FROM taptime_server.offline_installations ORDER BY id')).rows).toEqual(originalInstallations);
    // A normal lease refresh may later register the lost binding again. Its retained sequence still counts.
    const refreshedLease = await issue(pool,'a',lostBinding);
    expect.soft(await ingest(pool,command(a,refreshedLease,2,0,lostBinding)))
      .toMatchObject({status:'review_pending',reason:'predecessor_requires_review'});
    const stored = (await pool.query('SELECT * FROM taptime_server.restore_recovery_evidence WHERE id=$1',[lostDecision.evidenceId])).rows[0];
    expect(stored.envelope.evidence).toEqual(second);
    expect(lostDecision.evidenceDigest).toBe(createHash('sha256').update(encodeRestoreEvidenceV1(stored.envelope)).digest('hex'));
    expect(stored).toMatchObject({organization_id:a.organization,user_id:a.user,membership_id:a.membership,request_hash:expect.any(String)});
    expect((await pool.query('SELECT operation_id FROM taptime_server.offline_review_restore_references WHERE work_event_id=$1',[following.workEvent.id])).rows)
      .toEqual([{operation_id:operationId}]);
    await expect(pool.query('UPDATE taptime_server.restore_recovery_evidence SET reason=$1 WHERE id=$2',['origin_lost',lostDecision.evidenceId])).rejects.toMatchObject({code:'42501'});
    await expect(pool.query('DELETE FROM taptime_server.restore_recovery_evidence WHERE id=$1',[lostDecision.evidenceId])).rejects.toMatchObject({code:'42501'});
    const app = await pool.connect();
    try {
      await app.query('BEGIN'); await app.query('SET LOCAL ROLE taptime_offline_event_ingestor');
      expect((await app.query('SELECT * FROM taptime_server.restore_recovery_evidence')).rows).toEqual([]);
      await expect(app.query('INSERT INTO taptime_server.restore_recovery_evidence DEFAULT VALUES')).rejects.toMatchObject({code:'42501'});
      await app.query('ROLLBACK');
    } finally { app.release(); }
    const archiveClient = await pool.connect();
    try {
      await archiveClient.query('BEGIN'); await archiveClient.query('SET LOCAL ROLE taptime_wal_archiver');
      const pending = (await archiveClient.query('SELECT * FROM taptime_server.read_pending_offsite_wal_files_v1()')).rows;
      const requirements = (await pool.query('SELECT required_wal_file FROM taptime_server.restore_evidence_archive_requirements')).rows;
      for (const row of requirements) expect(pending).toContainEqual({wal_file:row.required_wal_file});
      expect(Number((await archiveClient.query('SELECT * FROM taptime_server.read_offsite_wal_archive_backlog_v1()')).rows[0].pending_count))
        .toBeGreaterThanOrEqual(requirements.length);
      await archiveClient.query('COMMIT');
      const label = await docker('exec',name,'cat','/recovery-archive/base/backup_label');
      const start = /START WAL LOCATION: (\S+) \(file (\w+)\)/.exec(label)!;
      const baseName = `base-${evidence.cluster}-20261111T000000Z`;
      const lastWal = (await pool.query('SELECT pg_walfile_name(pg_switch_wal()) AS file')).rows[0].file;
      const walFiles = (await docker('exec',name,'ls','/var/lib/postgresql/data/pg_wal')).split('\n')
        .filter(file=>/^[0-9A-F]{24}$/.test(file)&&file>=start[2]!&&file<=lastWal).sort();
      await archiveClient.query('BEGIN'); await archiveClient.query('SET LOCAL ROLE taptime_wal_archiver');
      await archiveClient.query('SELECT taptime_server.record_offsite_base_backup_v1($1,$2,$3)',[baseName,start[1],start[2]]);
      for (const file of walFiles) {
        await docker('exec',name,'cp',`/var/lib/postgresql/data/pg_wal/${file}`,`/recovery-archive/${file}`);
        const digest = (await docker('exec',name,'sha256sum',`/recovery-archive/${file}`)).split(' ')[0];
        await archiveClient.query('SELECT taptime_server.record_offsite_wal_archive_v1($1,$2,$3)',[file,`wal-${evidence.cluster}-${file}`,digest]);
        await archiveClient.query('SELECT taptime_server.advance_offsite_wal_archive_watermark_v1($1,$2)',[baseName,file]);
      }
      await archiveClient.query('COMMIT');
    } finally { archiveClient.release(); }
    expect(await recover(pool,operationId,second)).toEqual({...lostDecision,idempotentRetry:true,archiveStatus:'offsite_archived'});
    expect(await recover(pool,operationId,{...second,receipt:{...second.receipt,id:randomUUID()}})).toMatchObject({status:'conflict'});
    const laterEnvelope = command(a,lease,6,6000);
    expect(await recover(pool,operationId,laterEnvelope)).toMatchObject({status:'recovery_pending',archiveStatus:'archive_pending'});
    // The recovery envelope at 6 proves only 6; 5 stays a real gap until a skip proves it.
    const seventh = command(a,lease,7,6000);
    expect(await ingest(pool,seventh)).toMatchObject({status:'pending',reason:'sequence_gap'});
    const skipped = command(a,lease,5,6000);
    const coordinator = new OfflineLifecycleIngestionCoordinator(pool,verifier);
    const skipCommand = {organizationId:a.organization!,expectedMembershipId:a.membership!,installationBinding:binding,
      deviceSequence:5,workEventId:skipped.workEvent.id,receiptId:skipped.receipt.id,leaseId:lease.leaseId,
      leaseItemId:lease.items[0]!.itemId,occurredAt:skipped.workEvent.occurredAt,reason:'invalid_response' as const,evidenceSha256:'a'.repeat(64)};
    expect(await coordinator.skip({accessToken:'a',command:skipCommand})).toMatchObject({status:'reported'});
    expect(await ingest(pool,seventh)).toMatchObject({status:'review_pending',reason:'predecessor_requires_review'});
    expect(await coordinator.skip({accessToken:'a',command:{...skipCommand,deviceSequence:6,
      workEventId:laterEnvelope.workEvent.id,receiptId:laterEnvelope.receipt.id}})).toEqual({status:'conflict'});
    expect.soft((await pool.query('SELECT status FROM taptime_server.time_entries WHERE user_id=$1',[a.user])).rows).toEqual([{status:'started'}]);
  } finally {
    await Promise.allSettled(pools.map(pool => pool.end()));
    for (const name of containers) await docker('rm','-f',name).catch(()=>undefined);
    for (const name of volumes) await docker('volume','rm',name).catch(()=>undefined);
  }
},120000);
