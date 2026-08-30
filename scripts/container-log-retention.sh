#!/usr/bin/env bash
#
# Age out the Docker container logs of the `stigvidd` stack.
#
# THIS SCRIPT IS A COMPLIANCE CONTROL, NOT HOUSEKEEPING. The privacy policy states
# a number — "Serverloggar: 7 dagar" / "Server logs: 7 days"
# (web/public/privacy-policy/index.html §5, both languages) — and container logs
# are personal data: `db` runs with log_connections=on behind a publicly published
# 5432, so every connection attempt is recorded with its source IP, and the API
# logs request context. Nothing else deletes them.
#
# THE TRAP: Docker's json-file driver (and `local`) have NO time-based retention.
# max-size / max-file, set via the x-logging anchor in docker-compose.yml, bound
# DISK — not AGE. A quiet service keeps its oldest line forever under any size cap,
# and the driver's own default is no rotation at all. So the caps are half the
# promise and this script is the other half. It must therefore RECUR: a systemd
# timer runs it daily on the host (DEPLOYMENT.md Part 1). A one-off run is the
# failure mode, because nothing afterwards reports that logs have aged past the
# window — the stack keeps working and the published policy quietly stops being true.
#
# Do not raise CONTAINER_LOG_RETENTION_DAYS without changing §5 in BOTH languages.
#
# What it does, per container in the project:
#   1. deletes ROTATED segments (<log>.1, <log>.2, ...) older than the window.
#      Safe unconditionally: Docker only ever reads those back for `docker logs`.
#   2. rewrites the ACTIVE segment, keeping only lines whose json `time` field is
#      inside the window — and writes back THROUGH THE SAME INODE (`cat tmp > log`,
#      never `mv`), because Docker holds an open fd on that file. A `mv` would
#      leave the daemon writing to an unlinked inode and the log would appear to
#      stop dead until the container was recreated.
#
# THE RACE, stated honestly: step 2 is logrotate's `copytruncate` tradeoff. A line
# appended between the read and the write-back is lost. It is bounded — the rewrite
# is skipped entirely unless something would actually be dropped, so on a daily
# timer it happens at most once a day per container, and costs a few lines of log.
# The alternative (leaving personal data past its stated retention) is worse.
#
# Docker's rotation counter is in-memory and does not know the active file shrank,
# so the first rotation after a prune fires early. Harmless, and self-correcting.
#
# Needs root: /var/lib/docker/containers is 0700 root-owned.
#
# Usage (from the compose directory, with .env present):
#   sudo ./scripts/container-log-retention.sh            # apply
#   sudo ./scripts/container-log-retention.sh --dry-run  # report only, touch nothing
#
# Idempotent; re-running it is always safe.
#
# See docs/notes/json-file-has-no-time-retention.md and docs/observability.md.
#
set -euo pipefail

# Temp files below hold log content, which is personal data. Create them 0600 from
# the outset rather than chmod-ing after the fact.
umask 077

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mwarn:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31mError:\033[0m %s\n' "$*" >&2; exit 1; }

DRY_RUN=0
case "${1:-}" in
  --dry-run) DRY_RUN=1 ;;
  '') ;;
  *) die "unknown argument '$1' (expected --dry-run)" ;;
esac

# Guarded explicitly: the line filter runs inside a pipeline whose exit status
# `set -e` does not check, so a missing python3 would leave every active log
# unpruned while the script exited 0 saying there was nothing to do. A false
# success on a compliance control is worse than a hard failure.
command -v python3 >/dev/null || die "python3 not found on PATH"
command -v docker  >/dev/null || die "docker not found on PATH"

# Read the deploy host's .env the same way compose does — first '=' only, one
# layer of surrounding quotes stripped, comments and blanks skipped.
ENV_FILE="${ENV_FILE:-.env}"
if [ -f "$ENV_FILE" ]; then
  while IFS= read -r line; do
    case "$line" in ''|\#*) continue;; *=*) ;; *) continue;; esac
    key=${line%%=*}
    value=${line#*=}
    case "$value" in
      \"*\") value=${value#\"}; value=${value%\"} ;;
      \'*\') value=${value#\'}; value=${value%\'} ;;
    esac
    case "$key" in CONTAINER_LOG_*) export "$key=$value";; esac
  done < "$ENV_FILE"
else
  warn "$ENV_FILE not found — relying on the environment"
fi

DAYS="${CONTAINER_LOG_RETENTION_DAYS:-7}"
case "$DAYS" in
  ''|*[!0-9]*) die "CONTAINER_LOG_RETENTION_DAYS must be a whole number of days, got '$DAYS'" ;;
esac
[ "$DAYS" -gt 0 ] || die "CONTAINER_LOG_RETENTION_DAYS must be at least 1, got '$DAYS'"

CUTOFF_EPOCH=$(( $(date +%s) - DAYS * 86400 ))
CUTOFF_HUMAN=$(date -u -d "@${CUTOFF_EPOCH}" +%Y-%m-%dT%H:%M:%SZ)

log "Retention window: ${DAYS} day(s) — dropping log entries older than ${CUTOFF_HUMAN}"
[ "$DRY_RUN" -eq 1 ] && log "DRY RUN — nothing will be written or deleted"

mapfile -t cids < <(docker compose ps -q 2>/dev/null || true)
if [ "${#cids[@]}" -eq 0 ] || [ -z "${cids[0]}" ]; then
  log "No containers running for this compose project — nothing to do."
  exit 0
fi

removed_files=0; dropped_lines=0; touched=0; skipped=0

for cid in "${cids[@]}"; do
  [ -n "$cid" ] || continue
  name=$(docker inspect --format '{{.Name}}' "$cid" 2>/dev/null | sed 's|^/||') || continue
  driver=$(docker inspect --format '{{.HostConfig.LogConfig.Type}}' "$cid" 2>/dev/null || echo "")
  path=$(docker inspect --format '{{.LogPath}}' "$cid" 2>/dev/null || echo "")

  # Only json-file and local write the per-container files this script prunes. Any
  # other driver (journald, a remote collector) has its own retention and is not
  # ours to touch — say so rather than skipping silently, because a driver change
  # would otherwise take the retention guarantee with it unnoticed.
  case "$driver" in
    json-file|local) ;;
    *) warn "$name: log driver is '${driver:-unknown}', not json-file — retention for it is NOT enforced here"
       skipped=$((skipped + 1)); continue ;;
  esac

  if [ -z "$path" ] || [ ! -f "$path" ]; then
    warn "$name: no readable log file at '${path:-<none>}' — skipped"
    skipped=$((skipped + 1)); continue
  fi
  if [ ! -r "$path" ]; then
    die "$name: cannot read $path — run this as root (/var/lib/docker/containers is 0700)"
  fi

  # 1. Rotated segments. Whole-file granularity, so mtime is enough: the newest
  #    line in <log>.N is what stopped it being the active file.
  while IFS= read -r old; do
    [ -n "$old" ] || continue
    if [ "$DRY_RUN" -eq 1 ]; then
      log "$name: would remove rotated segment $(basename "$old")"
    else
      rm -f -- "$old"
    fi
    removed_files=$((removed_files + 1))
  done < <(find "$(dirname "$path")" -maxdepth 1 -type f \
             -name "$(basename "$path").*" \
             -not -newermt "@${CUTOFF_EPOCH}" 2>/dev/null || true)

  # 2. Active segment. Stream it rather than slurping — a 10m cap is the steady
  #    state, but a container that ran before the cap existed can have gigabytes.
  tmp=$(mktemp "${TMPDIR:-/tmp}/stigvidd-log-retention.XXXXXX")
  # shellcheck disable=SC2064  # $tmp must expand now, not at trap time
  trap "rm -f -- '$tmp'" EXIT

  dropped=$(python3 - "$path" "$tmp" "$CUTOFF_EPOCH" <<'PY'
import calendar, json, sys, time

src, dst, cutoff = sys.argv[1], sys.argv[2], int(sys.argv[3])
dropped = 0

def entry_epoch(raw):
    """Seconds for a docker json-file line, or None if it cannot be read.

    Docker writes RFC3339 with nanoseconds ("2026-08-30T09:12:33.123456789Z").
    strptime tops out at microseconds, so trim the fraction rather than parsing
    it — sub-second precision is meaningless against a multi-day cutoff.
    """
    try:
        stamp = json.loads(raw).get("time")
    except (ValueError, AttributeError):
        return None
    if not isinstance(stamp, str):
        return None
    head = stamp.split(".", 1)[0].rstrip("Z")
    try:
        # Docker always writes UTC here, so timegm, not mktime.
        return calendar.timegm(time.strptime(head, "%Y-%m-%dT%H:%M:%S"))
    except ValueError:
        return None

with open(src, "r", encoding="utf-8", errors="replace") as fin, \
     open(dst, "w", encoding="utf-8") as fout:
    for raw in fin:
        when = entry_epoch(raw)
        # An unparseable line has no age to judge, so it is KEPT. Erring the other
        # way would let a malformed write silently delete a log this script cannot
        # account for; a kept line is at worst noise, and the size cap still bounds it.
        if when is not None and when < cutoff:
            dropped += 1
            continue
        fout.write(raw)

print(dropped)
PY
  ) || die "$name: failed to filter $path"

  if [ "$dropped" -gt 0 ]; then
    if [ "$DRY_RUN" -eq 1 ]; then
      log "$name: would drop ${dropped} entr$([ "$dropped" -eq 1 ] && echo y || echo ies) from the active log"
    else
      # Same inode, deliberately: Docker holds this file open (O_APPEND), so a
      # rename or a copy-then-move would leave it writing into an unlinked inode.
      cat -- "$tmp" > "$path" || die "$name: could not write back $path"
      log "$name: dropped ${dropped} entr$([ "$dropped" -eq 1 ] && echo y || echo ies) from the active log"
    fi
    dropped_lines=$((dropped_lines + dropped))
    touched=$((touched + 1))
  fi

  rm -f -- "$tmp"
  trap - EXIT
done

verb="removed"; verb2="dropped"
[ "$DRY_RUN" -eq 1 ] && { verb="would be removed"; verb2="would be dropped"; }
log "Done. ${#cids[@]} container(s): ${removed_files} rotated segment(s) ${verb}, ${dropped_lines} entr$([ "$dropped_lines" -eq 1 ] && echo y || echo ies) ${verb2} from ${touched} active log(s), ${skipped} skipped."
[ "$skipped" -gt 0 ] && warn "Skipped containers are NOT covered by the retention the privacy policy states."
exit 0
