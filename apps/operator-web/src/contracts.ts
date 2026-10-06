import { OperatorError } from "./OperatorError";
export const OPERATOR_PACKAGE_ACCEPT = 'application/vnd.taptime.operator.v2+json';
export interface PackageUsage {
  package_size: number | null;
  active_access_count: number;
  current_month: string;
  current_month_peak: number;
  previous_month: string;
  previous_month_peak: number;
}
export interface Organization {
  package_usage?: PackageUsage;
  organization_id: string;
  name: string;
  status: "active" | "paused";
  created_at: string;
  row_version: number;
  administrators: number;
  location_managers: number;
  employees: number;
  active_now: number;
  last_tap: string | null;
  tags: number;
  active_assignments: number;
  open_invitations: number;
}
export interface Overview {
  organizations: Organization[];
  totals: {
    organizations: number;
    administrators: number;
    location_managers: number;
    employees: number;
    active_now: number;
    taps_today: number;
  };
}
export interface AuditEvent {
  package_size_before?: number | null;
  package_size_after?: number | null;
  id: string;
  organization_id: string | null;
  action: string;
  reason: string | null;
  created_at: string;
  actor: "root" | "operator";
}
export interface Audit {
  events: AuditEvent[];
  next_before: string | null;
}
export interface Health {
  database_bytes: number;
  last_archived_at: string | null;
  last_base_at: string | null;
  version: string | null;
}
function invalid(): never {
  throw new OperatorError("invalid_response");
}
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) invalid();
  return v as Record<string, unknown>;
}
function fields(v: Record<string, unknown>, keys: string[]) {
  if (Object.keys(v).length !== keys.length || keys.some((k) => !(k in v)))
    invalid();
}
function text(v: unknown): v is string {
  return typeof v === "string";
}
function nullableText(v: unknown) {
  return v === null || text(v);
}
function count(v: unknown) {
  return Number.isSafeInteger(v) && Number(v) >= 0;
}
export function overviewResult(v: Record<string, unknown>): Overview {
  fields(v, ["status", "organizations", "totals"]);
  if (v.status !== "succeeded" || !Array.isArray(v.organizations)) invalid();
  const totals = object(v.totals);
  fields(totals, [
    "organizations",
    "administrators",
    "location_managers",
    "employees",
    "active_now",
    "taps_today",
  ]);
  if (!Object.values(totals).every(count)) invalid();
  for (const value of v.organizations) {
    const row = object(value);
    fields(row, [
      "organization_id",
      "name",
      "status",
      "created_at",
      "row_version",
      "administrators",
      "location_managers",
      "employees",
      "active_now",
      "last_tap",
      "tags",
      "active_assignments",
      "open_invitations",
    ]);
    if (
      !text(row.organization_id) ||
      !text(row.name) ||
      !text(row.created_at) ||
      !nullableText(row.last_tap) ||
      !["active", "paused"].includes(String(row.status))
    )
      invalid();
    if (
      ![
        "row_version",
        "administrators",
        "location_managers",
        "employees",
        "active_now",
        "tags",
        "active_assignments",
        "open_invitations",
      ].every((k) => count(row[k])) ||
      Number(row.row_version) < 1
    )
      invalid();
  }
  return v as unknown as Overview;
}
export function auditResult(v: Record<string, unknown>): Audit {
  fields(v, ["status", "events", "next_before"]);
  if (
    v.status !== "succeeded" ||
    !Array.isArray(v.events) ||
    !(
      v.next_before === null ||
      (typeof v.next_before === "string" &&
        /^[1-9][0-9]{0,17}$/.test(v.next_before))
    )
  )
    invalid();
  for (const item of v.events) {
    const row = object(item);
    fields(row, [
      "id",
      "organization_id",
      "action",
      "reason",
      "created_at",
      "actor",
    ]);
    if (
      !text(row.id) ||
      !text(row.action) ||
      !text(row.created_at) ||
      !nullableText(row.reason) ||
      !nullableText(row.organization_id) ||
      !["root", "operator"].includes(String(row.actor))
    )
      invalid();
  }
  return v as unknown as Audit;
}
export function healthResult(v: Record<string, unknown>): Health {
  fields(v, [
    "status",
    "database_bytes",
    "last_archived_at",
    "last_base_at",
    "version",
  ]);
  if (
    v.status !== "succeeded" ||
    !count(v.database_bytes) ||
    !["last_archived_at", "last_base_at", "version"].every((k) =>
      nullableText(v[k]),
    )
  )
    invalid();
  return v as unknown as Health;
}
export function mutationResult(v: Record<string, unknown>) {
  if (v.status !== "succeeded" || !text(v.organization_id)) invalid();
  return v;
}

function packageSize(value: unknown): boolean {
  return value === null || (count(value) && Number(value) >= 1 && Number(value) <= 2147483647);
}
export function overviewResultV2(v: Record<string,unknown>): Overview {
  if (!Array.isArray(v.organizations)) invalid();
  const organizations=v.organizations.map(value=>{
    const {package_usage,...previous}=object(value);
    const usage=object(package_usage);
    fields(usage,['package_size','active_access_count','current_month','current_month_peak','previous_month','previous_month_peak']);
    if (!packageSize(usage.package_size)
      || !['active_access_count','current_month_peak','previous_month_peak'].every(k=>count(usage[k]))
      || !['current_month','previous_month'].every(k=>typeof usage[k]==='string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(usage[k] as string))) invalid();
    return previous;
  });
  overviewResult({...v,organizations});
  return v as unknown as Overview;
}
export function auditResultV2(v: Record<string,unknown>): Audit {
  if (!Array.isArray(v.events)) invalid();
  const events=v.events.map(value=>{
    const {package_size_before,package_size_after,...previous}=object(value);
    if (!packageSize(package_size_before) || !packageSize(package_size_after)) invalid();
    return previous;
  });
  auditResult({...v,events});
  return v as unknown as Audit;
}
