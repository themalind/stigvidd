#!/usr/bin/env bash
#
# Apply the metrics retention override in OpenObserve.
#
# OpenObserve has exactly ONE global retention default (ZO_COMPACT_DATA_RETENTION_DAYS,
# set to OBSERVATORY_RETENTION_DAYS in docker-compose.yml) and no per-stream-TYPE
# setting. The only finer control is a `data_retention` override on an individual
# stream. So the split policy — 7 days for logs and traces, 2 years for metrics —
# is implemented as: a low global default, plus this script raising every metrics
# stream to OBSERVATORY_METRICS_RETENTION_DAYS.
#
# The global is deliberately the LOW value so that anything not explicitly
# overridden fails safe towards a small disk rather than a full one.
#
# THE TRAP: a metrics stream is created the first time that metric is INGESTED.
# A stream that does not exist yet cannot be overridden, so it starts life on the
# 7-day global. New metric names appear only when someone adds instrumentation —
# a deliberate, reviewable code change — so the rule is:
#
#     Any change that adds a Meter, a counter, or a new instrumentation package
#     must be followed by re-running this script on the host.
#
# This script is idempotent; re-running it is always safe.
#
# GDPR: the 730-day metrics window is lawful ONLY because metrics carry no
# personal data. This script therefore also warns about any metrics stream whose
# schema contains an identifier-shaped field. See docs/observability.md.
#
# Usage (from the compose directory, with .env present):
#   ./scripts/observatory-retention.sh            # apply
#   ./scripts/observatory-retention.sh --dry-run  # show what would change
#
set -euo pipefail

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mwarn:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31mError:\033[0m %s\n' "$*" >&2; exit 1; }

DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

command -v curl >/dev/null || die "curl not found on PATH"
# Guarded explicitly, because `set -e` cannot catch this one: both JSON parses below run
# inside command/process substitution, whose exit status is never checked. Without this a
# missing python3 leaves the stream list empty and the script exits 0 reporting "nothing to
# do" — silently leaving every metrics stream on the short global retention AND skipping the
# personal-data check at the end. Both are compliance controls (docs/observability.md), so a
# false success here is worse than a hard failure.
command -v python3 >/dev/null || die "python3 not found on PATH"

# Read the deploy host's .env the same way compose does. Values may contain '=',
# so split on the first one only, and skip comments/blanks.
ENV_FILE="${ENV_FILE:-.env}"
if [ -f "$ENV_FILE" ]; then
  while IFS= read -r line; do
    case "$line" in ''|\#*) continue;; *=*) ;; *) continue;; esac
    key=${line%%=*}
    value=${line#*=}
    # compose strips one layer of surrounding quotes; do the same. Otherwise a perfectly
    # valid OBSERVATORY_ROOT_PASSWORD="pa55!#" authenticates with the quotes included and
    # comes back as a 401 that looks exactly like a wrong password.
    case "$value" in
      \"*\") value=${value#\"}; value=${value%\"} ;;
      \'*\') value=${value#\'}; value=${value%\'} ;;
    esac
    case "$key" in OBSERVATORY_*) export "$key=$value";; esac
  done < "$ENV_FILE"
else
  warn "$ENV_FILE not found — relying on the environment"
fi

: "${OBSERVATORY_DOMAIN:?OBSERVATORY_DOMAIN must be set (in .env or the environment)}"
: "${OBSERVATORY_ROOT_EMAIL:?OBSERVATORY_ROOT_EMAIL must be set}"
: "${OBSERVATORY_ROOT_PASSWORD:?OBSERVATORY_ROOT_PASSWORD must be set}"
ORG="${OBSERVATORY_ORG:-default}"
DAYS="${OBSERVATORY_METRICS_RETENTION_DAYS:-730}"

# Production is HTTPS through the proxy. OBSERVATORY_BASE_URL overrides the whole
# origin so the same script works against a local dev instance on plain HTTP
# (see README "Telemetry"), without special-casing anything.
BASE="${OBSERVATORY_BASE_URL:-https://${OBSERVATORY_DOMAIN}}/api/${ORG}"
AUTH="${OBSERVATORY_ROOT_EMAIL}:${OBSERVATORY_ROOT_PASSWORD}"

# Admin operation, so this uses the ROOT credentials — deliberately not the
# ingest account, which has no business changing stream settings.
api() {
  local method="$1" path="$2"; shift 2
  curl -fsS -u "$AUTH" -X "$method" "$@" "${BASE}${path}"
}

log "Listing metrics streams in org '${ORG}' at ${OBSERVATORY_DOMAIN}"
streams_json=$(api GET "/streams?type=metrics") \
  || die "could not list streams — check OBSERVATORY_DOMAIN and the root credentials"

# Field order in the response is not guaranteed, so parse per-stream rather than
# grepping names and retentions independently and hoping they line up.
mapfile -t streams < <(printf '%s' "$streams_json" | python3 -c '
import json,sys
for s in json.load(sys.stdin).get("list", []):
    print(s.get("name",""))
' )

[ "${#streams[@]}" -gt 0 ] || { log "No metrics streams exist yet — nothing to do."; exit 0; }

changed=0; skipped=0; pending=0
for name in "${streams[@]}"; do
  [ -n "$name" ] || continue
  current=$(printf '%s' "$streams_json" | python3 -c '
import json,sys
want=sys.argv[1]
for s in json.load(sys.stdin).get("list", []):
    if s.get("name")==want:
        print((s.get("settings") or {}).get("data_retention",""))
        break
' "$name")

  # 0 is OpenObserve's sentinel for "inherit the global default", not "0 days".
  [ "$current" = "0" ] && current=""

  if [ "$current" = "$DAYS" ]; then
    skipped=$((skipped+1))
    continue
  fi

  if [ "$DRY_RUN" -eq 1 ]; then
    log "would set ${name}: ${current:-<global>} -> ${DAYS} days"
    pending=$((pending+1))
    continue
  fi

  api PUT "/streams/${name}/settings?type=metrics" \
    -H 'Content-Type: application/json' \
    -d "{\"data_retention\": ${DAYS}}" >/dev/null \
    || { warn "failed to update '${name}'"; continue; }
  log "${name}: ${current:-<global>} -> ${DAYS} days"
  changed=$((changed+1))
done

# Counted separately: reporting "N changed" after a --dry-run reads as work done.
if [ "$DRY_RUN" -eq 1 ]; then
  log "Dry run. ${pending} would change, ${skipped} already at ${DAYS} days."
else
  log "Done. ${changed} changed, ${skipped} already at ${DAYS} days."
fi

# GDPR guard: metrics are kept for two years, which is only lawful while they
# hold no personal data. Flag identifier-shaped fields rather than silently
# retaining them — see docs/observability.md.
# The stream list omits schemas unless explicitly asked, so this needs its own
# call with fetchSchema=true.
schemas_json=$(api GET "/streams?type=metrics&fetchSchema=true" || true)
suspect=$(printf '%s' "$schemas_json" | python3 -c '
import json, re, sys

# Fields every OTLP metric stream carries. Not personal data, never flagged.
INTERNAL = {
    "__hash__", "__name__", "_timestamp", "value", "flag", "start_time",
    "is_monotonic", "aggregation_temporality", "service_name",
    "instrumentation_library_name", "instrumentation_library_version",
    "exemplars", "span_id", "trace_id",
}
# Matched against underscore/dot-separated TOKENS, not substrings, so that
# "latency" does not trip the "lat" rule.
IDENT_TOKENS = {
    "user", "userid", "uid", "sub", "subject", "session", "sessionid",
    "email", "mail", "ip", "clientip", "remoteaddr", "device", "deviceid",
    "token", "lat", "latitude", "lon", "lng", "longitude", "coord",
    "coords", "coordinate", "coordinates", "geo", "phone", "name",
}
out = set()
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
for stream in data.get("list", []):
    for field in (stream.get("schema") or []):
        fname = field.get("name", "")
        if fname in INTERNAL:
            continue
        tokens = [t for t in re.split(r"[^a-z0-9]+", fname.lower()) if t]
        if any(t in IDENT_TOKENS for t in tokens):
            out.add(str(stream.get("name")) + "." + fname)
print("\n".join(sorted(out)))
')
if [ -n "$suspect" ]; then
  warn "metrics fields that look like personal data — the 730-day window is NOT"
  warn "lawful while these exist. Remove them at the instrumentation site:"
  printf '%s\n' "$suspect" | sed 's/^/       /' >&2
fi
