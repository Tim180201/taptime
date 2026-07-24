import { createHash } from 'node:crypto';
import type { AccessTokenVerifier } from '@taptime/backend-identity';
import {
  MOBILE_OWN_TIME_LIMIT_MAXIMUM,
  validateClosedPageRequest,
  validateProjectCreateRequest,
  validateProjectDeactivateRequest,
  type ProjectSummary,
} from '@taptime/mobile-work-contract';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type {
  MobileReadCommand,
  MobileReadResult,
  ProjectAdministrationPort,
  ProjectMutationResult,
} from './types.js';

const IDENTITY_ROLE = 'taptime_identity_resolver';
const PROJECT_ROLE = 'taptime_project_administrator';

interface ActorRow extends QueryResultRow {
  readonly user_id: string;
  readonly organization_id: string;
  readonly membership_id: string;
  readonly membership_role: 'employee' | 'administrator';
}

interface ProjectRow extends QueryResultRow {
  readonly project_id: string;
  readonly display_name: string;
  readonly active: boolean;
  readonly row_version: string | number;
}

interface ReceiptRow extends QueryResultRow {
  readonly command_type: 'create' | 'deactivate';
  readonly request_hash: string;
  readonly project_id: string;
  readonly result_display_name: string;
  readonly result_active: boolean;
  readonly result_row_version: string | number;
}

interface ProjectCursor {
  readonly displayName: string;
  readonly projectId: string;
}

export class ProjectAdministrationCoordinator implements ProjectAdministrationPort {
  constructor(
    private readonly pool: Pool,
    private readonly accessTokenVerifier: AccessTokenVerifier,
  ) {}

  async queryProjects(
    command: MobileReadCommand<Parameters<ProjectAdministrationPort['queryProjects']>[0]['request']>,
  ): Promise<MobileReadResult<{
    readonly projects: readonly ProjectSummary[];
    readonly nextCursor: string | null;
  }>> {
    if (!validateClosedPageRequest(command.request, MOBILE_OWN_TIME_LIMIT_MAXIMUM)) {
      return { status: 'invalid_request' };
    }
    const cursor = decodeCursor(command.request.cursor);
    if (cursor === undefined) return { status: 'invalid_request' };

    return this.withAdministrator(command.accessToken, command.request.expectedMembershipId,
      async (client, actor) => {
        const rows = await client.query<ProjectRow>(
          `SELECT id AS project_id, display_name, active, row_version
           FROM taptime_server.projects
           WHERE organization_id = $1::uuid
             AND (
               $2::text IS NULL
               OR (display_name COLLATE "C", id)
                  > ($2::text COLLATE "C", $3::uuid)
             )
           ORDER BY display_name COLLATE "C", id
           LIMIT $4`,
          [
            actor.organization_id,
            cursor?.displayName ?? null,
            cursor?.projectId ?? null,
            command.request.limit + 1,
          ],
        );
        const hasMore = rows.rows.length > command.request.limit;
        const page = rows.rows.slice(0, command.request.limit);
        const last = page.at(-1);
        return {
          status: 'succeeded',
          response: {
            projects: page.map(mapProject),
            nextCursor: hasMore && last !== undefined
              ? encodeCursor({
                  displayName: last.display_name,
                  projectId: last.project_id,
                })
              : null,
          },
        };
      });
  }

  async createProject(
    command: MobileReadCommand<Parameters<ProjectAdministrationPort['createProject']>[0]['request']>,
  ): Promise<ProjectMutationResult> {
    if (!validateProjectCreateRequest(command.request)) return { status: 'invalid_request' };
    return this.withAdministrator(command.accessToken, command.request.expectedMembershipId,
      async (client, actor) => {
        const digest = requestDigest([
          'project-create-v1',
          actor.organization_id,
          actor.user_id,
          actor.membership_id,
          command.request.projectId,
          command.request.displayName,
        ]);
        const replay = await findReceipt(client, actor.organization_id, command.request.commandId);
        if (replay !== null) {
          return mapReplay(command.request.commandId, digest, replay);
        }
        const existing = await client.query(
          `SELECT 1 FROM taptime_server.projects
           WHERE organization_id = $1::uuid AND id = $2::uuid`,
          [actor.organization_id, command.request.projectId],
        );
        if (existing.rowCount !== 0) return { status: 'project_unavailable' };
        await client.query(
          `INSERT INTO taptime_server.projects (
             id, organization_id, display_name, active
           ) VALUES ($1::uuid, $2::uuid, $3, true)`,
          [command.request.projectId, actor.organization_id, command.request.displayName],
        );
        await client.query(
          `SELECT taptime_server.append_project_audit_v1(
             $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
             'ProjectCreated', $6::jsonb
           )`,
          [
            actor.organization_id,
            actor.user_id,
            actor.membership_id,
            command.request.commandId,
            command.request.projectId,
            JSON.stringify({ schemaVersion: 1 }),
          ],
        );
        await insertReceipt(client, actor, command.request.commandId, 'create',
          digest, command.request.projectId, command.request.displayName, true, 1);
        return {
          status: 'succeeded',
          idempotentRetry: false,
          project: {
            projectId: command.request.projectId,
            displayName: command.request.displayName,
            active: true,
            rowVersion: 1,
          },
          receiptId: command.request.commandId,
        };
      });
  }

  async deactivateProject(
    command: MobileReadCommand<
      Parameters<ProjectAdministrationPort['deactivateProject']>[0]['request']
    >,
  ): Promise<ProjectMutationResult> {
    if (!validateProjectDeactivateRequest(command.request)) return { status: 'invalid_request' };
    return this.withAdministrator(command.accessToken, command.request.expectedMembershipId,
      async (client, actor) => {
        const digest = requestDigest([
          'project-deactivate-v1',
          actor.organization_id,
          actor.user_id,
          actor.membership_id,
          command.request.projectId,
          command.request.expectedRowVersion,
        ]);
        const replay = await findReceipt(client, actor.organization_id, command.request.commandId);
        if (replay !== null) {
          return mapReplay(command.request.commandId, digest, replay);
        }
        const locked = await client.query<ProjectRow>(
          `SELECT project_id, display_name, active, row_version
           FROM taptime_server.lock_project_for_administration_v1($1::uuid, $2::uuid)`,
          [actor.organization_id, command.request.projectId],
        );
        const project = locked.rows[0];
        if (project === undefined || !project.active) return { status: 'project_unavailable' };
        if (Number(project.row_version) !== command.request.expectedRowVersion) {
          return { status: 'stale_row_version' };
        }
        const activeUse = await client.query<{ active: boolean }>(
          `SELECT taptime_server.project_has_active_time_entry_v1(
             $1::uuid, $2::uuid
           ) AS active`,
          [actor.organization_id, command.request.projectId],
        );
        if (activeUse.rows[0]?.active === true) return { status: 'project_in_use' };
        const nextVersion = command.request.expectedRowVersion + 1;
        await client.query(
          `UPDATE taptime_server.projects
           SET active = false, deactivated_at = transaction_timestamp(),
               row_version = $3
           WHERE organization_id = $1::uuid AND id = $2::uuid`,
          [actor.organization_id, command.request.projectId, nextVersion],
        );
        await client.query(
          `SELECT taptime_server.append_project_audit_v1(
             $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
             'ProjectDeactivated', $6::jsonb
           )`,
          [
            actor.organization_id,
            actor.user_id,
            actor.membership_id,
            command.request.commandId,
            command.request.projectId,
            JSON.stringify({ schemaVersion: 1, rowVersion: nextVersion }),
          ],
        );
        await insertReceipt(client, actor, command.request.commandId, 'deactivate',
          digest, command.request.projectId, project.display_name, false, nextVersion);
        return {
          status: 'succeeded',
          idempotentRetry: false,
          project: {
            projectId: command.request.projectId,
            displayName: project.display_name,
            active: false,
            rowVersion: nextVersion,
          },
          receiptId: command.request.commandId,
        };
      });
  }

  private async withAdministrator<Response>(
    accessToken: string,
    expectedMembershipId: string,
    operation: (
      client: PoolClient,
      actor: ActorRow,
    ) => Promise<Response>,
  ): Promise<Response | { readonly status: 'unauthorized' | 'forbidden' }> {
    const verification = await this.accessTokenVerifier.verify(accessToken);
    if (verification.status === 'rejected') return { status: 'unauthorized' };
    const client = await this.pool.connect();
    let open = false;
    try {
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      open = true;
      await client.query(`SET LOCAL ROLE ${IDENTITY_ROLE}`);
      const actorResult = await client.query<ActorRow>(
        `SELECT user_id, organization_id, membership_id, membership_role
         FROM taptime_server.lock_request_actor($1, $2)`,
        [verification.identity.issuer, verification.identity.subject],
      );
      const actor = actorResult.rows[0];
      if (
        actorResult.rows.length !== 1
        || actor === undefined
        || actor.membership_id !== expectedMembershipId
        || actor.membership_role !== 'administrator'
      ) {
        await client.query('ROLLBACK');
        open = false;
        return { status: 'forbidden' };
      }
      await client.query(
        `SELECT set_config('app.user_id', $1, true),
                set_config('app.organization_id', $2, true),
                set_config('app.membership_id', $3, true),
                set_config('app.membership_role', 'administrator', true)`,
        [actor.user_id, actor.organization_id, actor.membership_id],
      );
      await client.query(`SET LOCAL ROLE ${PROJECT_ROLE}`);
      const result = await operation(client, actor);
      const status = (result as { status?: string }).status;
      await client.query(
        status === 'succeeded' ? 'COMMIT' : 'ROLLBACK',
      );
      open = false;
      return result;
    } catch (error) {
      if (open) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // Preserve original failure.
        }
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

async function findReceipt(
  client: PoolClient,
  organizationId: string,
  commandId: string,
): Promise<ReceiptRow | null> {
  const result = await client.query<ReceiptRow>(
    `SELECT command_type, request_hash, project_id, result_display_name,
            result_active, result_row_version
     FROM taptime_server.project_command_receipts
     WHERE organization_id = $1::uuid AND command_id = $2::uuid`,
    [organizationId, commandId],
  );
  return result.rows[0] ?? null;
}

async function mapReplay(
  commandId: string,
  expectedDigest: string,
  receipt: ReceiptRow,
): Promise<ProjectMutationResult> {
  if (receipt.request_hash.trim() !== expectedDigest) return { status: 'command_id_conflict' };
  return {
    status: 'succeeded',
    idempotentRetry: true,
    project: {
      projectId: receipt.project_id,
      displayName: receipt.result_display_name,
      active: receipt.result_active,
      rowVersion: Number(receipt.result_row_version),
    },
    receiptId: commandId,
  };
}

async function insertReceipt(
  client: PoolClient,
  actor: ActorRow,
  commandId: string,
  commandType: 'create' | 'deactivate',
  requestHash: string,
  projectId: string,
  resultDisplayName: string,
  resultActive: boolean,
  resultRowVersion: number,
): Promise<void> {
  await client.query(
    `INSERT INTO taptime_server.project_command_receipts (
       organization_id, command_id, actor_user_id, actor_membership_id,
       command_type, request_hash, project_id, result_display_name,
       result_active, result_row_version
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7::uuid, $8, $9, $10
     )`,
    [
      actor.organization_id,
      commandId,
      actor.user_id,
      actor.membership_id,
      commandType,
      requestHash,
      projectId,
      resultDisplayName,
      resultActive,
      resultRowVersion,
    ],
  );
}

function requestDigest(fields: readonly unknown[]): string {
  return createHash('sha256').update(JSON.stringify(fields), 'utf8').digest('hex');
}

function mapProject(row: ProjectRow): ProjectSummary {
  return {
    projectId: row.project_id,
    displayName: row.display_name,
    active: row.active,
    rowVersion: Number(row.row_version),
  };
}

function encodeCursor(cursor: ProjectCursor): string {
  return `v1:${Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')}`;
}

function decodeCursor(value: string | null): ProjectCursor | null | undefined {
  if (value === null) return null;
  if (!value.startsWith('v1:')) return undefined;
  try {
    const candidate: unknown = JSON.parse(
      Buffer.from(value.slice(3), 'base64url').toString('utf8'),
    );
    return typeof candidate === 'object' && candidate !== null
      && Object.keys(candidate).length === 2
      && typeof (candidate as Record<string, unknown>).displayName === 'string'
      && typeof (candidate as Record<string, unknown>).projectId === 'string'
      ? candidate as ProjectCursor
      : undefined;
  } catch {
    return undefined;
  }
}
