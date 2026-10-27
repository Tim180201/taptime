#!/usr/bin/env bash
# Measurement adapters only; no copy or edit of the production algorithms.
set -euo pipefail
source "$T136_SOURCE/infrastructure/backup/taptime-${1:?operation}"
operation="$1"
shift
source "$TAPTIME_BACKUP_CONFIG"

bulk_names=()
borg() {
  # Counterfactual measurement only: buffer the exact source-selected WAL names.
  # All other retention logic is the sourced, unchanged production function.
  if [[ "${T136_BATCH_DELETE:-0}" == 1 ]]; then
    if [[ "$1" == delete && $# == 2 && "$2" == "$BORG_REPOSITORY::wal-"* ]]; then
      bulk_names+=("${2#*::}")
      return 0
    elif [[ "$1" == compact && ${#bulk_names[@]} -gt 0 ]]; then
      printf '%s\n' "${bulk_names[@]}" > "$T136_ROOT/batch-selected.txt"
      python3 "$T136_SOURCE/tests/backup-scale/borg-call.py" delete "$BORG_REPOSITORY" "${bulk_names[@]}" || return
      bulk_names=()
    fi
  fi
  python3 "$T136_SOURCE/tests/backup-scale/borg-call.py" "$@"
}
docker() {
  if [[ "$1" == run ]]; then
    shift
    # All run sites in the sourced functions must explicitly disable networking.
    [[ " $* " == *' --network none '* ]] || return 64
    if [[ " $* " == *' --detach '* ]]; then
      local identifier
      identifier="$(command docker --host unix:///var/run/docker.sock run --pull=never "$@")" || return
      [[ "$identifier" =~ ^[0-9a-f]{64}$ ]] || return 64
      printf '%s\n' "$identifier" >> "$T136_ROOT/spawned-containers.txt"
      printf '%s\n' "$identifier"
    else
      command docker --host unix:///var/run/docker.sock run --pull=never "$@"
    fi
  elif [[ "$1" == rm ]]; then
    shift
    command docker --host unix:///var/run/docker.sock rm --volumes "$@"
  else
    case "$1" in exec|inspect|logs|stop|volume) ;;
      *) printf 'Disallowed Docker operation: %s\n' "$1" >&2; return 64;; esac
    command docker --host unix:///var/run/docker.sock "$@"
  fi
}
validate_offsite_borg_repository() {
  # Explicit local-only adapter. No DNS/SSH/production configuration is used.
  [[ "$BORG_REPOSITORY" == "$T136_ROOT/"* && -d "$BORG_REPOSITORY" ]]
}
prepare_backup_workspace() {
  # Colima stores Docker data on a separate disk, unlike the production root FS.
  # Keep the production ownership/symlink checks; waive only filesystem equality.
  check_backup_workspace_path "$TAPTIME_BACKUP_STAGING_ROOT"
  install -d -o 0 -g 0 -m 0700 "$TAPTIME_BACKUP_STAGING_ROOT"
}
bounded_borg_lock() {
  local began acquired seconds="${2:-$(borg_lock_wait_seconds)}"
  began="$(date +%s.%N)"
  if ! flock -w "$seconds" "$1"; then
    printf 'lock-timeout|%s|%s\n' "$began" "$(date +%s.%N)" >> "$T136_LOCK_TRACE"
    return 1
  fi
  acquired="$(date +%s.%N)"
  printf 'lock-acquired|%s|%s\n' "$began" "$acquired" >> "$T136_LOCK_TRACE"
}

if [[ "${T136_ISOLATED_RETENTION:-0}" == 1 ]]; then
  [[ "${T136_MODE:-main}" == retention ]] || exit 64
  # Explicit counterfactual ONLY for the isolated deletion-cost experiment.
  # The unchanged production guard was measured first and defers on SET\nt.
  # Verify the genuine fixture receipt quietly, so the downstream original
  # prune/delete/compact function can be measured. Never enable for weekly main.
  production_base_is_registered() {
    local registered
    registered="$(docker exec --user postgres "$DATABASE_CONTAINER" psql --quiet \
      --tuples-only --no-align --set ON_ERROR_STOP=on --dbname="$DATABASE_NAME" \
      --command "SET ROLE taptime_wal_archiver; SELECT EXISTS (SELECT FROM \
        taptime_server.read_offsite_base_backup_receipt_v1('$1'));")"
    [[ "$registered" == t ]]
  }
fi

case "${T136_MODE:-main}" in
  main) main "$@";;
  retention)
    exec 9>"$TAPTIME_BORG_LOCK_FILE"
    bounded_borg_lock 9
    RESTORE_ARCHIVE_IDENTIFIER="$T136_CLUSTER"
    prune_after_verified_restore
    ;;
  archive-file)
    exec 9>"$TAPTIME_BORG_LOCK_FILE"
    bounded_borg_lock 9 "$ARCHIVER_BORG_LOCK_WAIT_SECONDS"
    CLUSTER_ARCHIVE_IDENTIFIER="$T136_CLUSTER"
    WAL_SPOOL_DIRECTORY="$T136_ROOT/confirmation-spool"
    uploaded_segments=0
    archive_file "$1"
    printf 'receipt-written|%s\n' "$(date +%s.%N)" >> "$T136_LOCK_TRACE"
    ;;
  plan-extract)
    RESTORE_ARCHIVE_IDENTIFIER="$T136_CLUSTER"
    started="$(date +%s.%N)"
    plan_restore_space "$1" ''
    printf 'plan-complete|%s|%s\n' "$started" "$(date +%s.%N)" >> "$T136_LOCK_TRACE"
    started="$(date +%s.%N)"
    extract_relevant_wal "$2" "$T136_ROOT/extraction"
    printf 'extract-complete|%s|%s\n' "$started" "$(date +%s.%N)" >> "$T136_LOCK_TRACE"
    rm -rf -- "$T136_ROOT/extraction"
    ;;
  *) exit 64;;
esac
