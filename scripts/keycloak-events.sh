#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Make the realm log failed sign-ins, without storing them in Keycloak's database.
#
# Logins never reach the API: the app and the admin web use the password grant
# straight against Keycloak, so only Keycloak knows a sign-in failed. What reports it
# is the realm's built-in `jboss-logging` event LISTENER, which writes each failure
# at WARN under the logger `org.keycloak.events`. From there the `authevents`
# collector forwards a whitelist of fields to OpenObserve (docker-compose.yml,
# observability/otel-auth-events.yaml).
#
# Two realm settings decide it, and they are independent:
#
#   eventsListeners  must include `jboss-logging`. Listeners fire on every event
#                    whatever `eventsEnabled` says. This script ADDS it and keeps
#                    any listener already there.
#   eventsEnabled    is the DATABASE store ("Save events" in the admin console).
#                    Forced to false: stored events carry the typed username and
#                    would ride along in every database backup, far past the 7 days
#                    the privacy policy promises. Logging needs none of it.
#
# This script is idempotent; re-running it is always safe. The realm settings live
# in Keycloak's database, so a host move carries them — but a realm re-imported
# from an export does not, so run it again after an import.
#
# Credentials: KEYCLOAK_OPS_USER / KEYCLOAK_OPS_PASSWORD if set, else KC_ADMIN_USER /
# KC_ADMIN_PASSWORD from .env (master realm). The password reaches kcadm through the
# KC_CLI_PASSWORD environment variable of the `exec`, never as a command-line
# argument, so it is not in the process list inside the container, and this script
# never prints it.
#
# Usage (from the compose directory, with .env present and keycloak running):
#   ./scripts/keycloak-events.sh            # apply
#   ./scripts/keycloak-events.sh --dry-run  # show what would change
#
# COMPOSE overrides the compose command, for a host where it is not
# `docker compose` (e.g. COMPOSE="docker-compose -p stigvidd").
set -euo pipefail

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mwarn:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31mError:\033[0m %s\n' "$*" >&2; exit 1; }

DRY_RUN=0
case "${1:-}" in
  --dry-run) DRY_RUN=1 ;;
  "") ;;
  *) die "unknown argument: $1 (only --dry-run is accepted)" ;;
esac

# Guarded for the same reason as in observatory-retention.sh: the JSON parse below
# runs in a command substitution whose failure `set -e` cannot see, and an empty
# listener list would then be written back over the realm's real one.
command -v python3 >/dev/null || die "python3 not found on PATH"

read -r -a COMPOSE_CMD <<< "${COMPOSE:-docker compose}"
command -v "${COMPOSE_CMD[0]}" >/dev/null || die "${COMPOSE_CMD[0]} not found on PATH"

# Read the deploy host's .env the way compose does: split on the first '=', strip
# one layer of quotes, skip comments. Only the keys this script uses, and a value
# already in the environment wins, so KEYCLOAK_REALM=… ./scripts/keycloak-events.sh
# does what it says.
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
    case "$key" in
      KC_ADMIN_USER|KC_ADMIN_PASSWORD|KEYCLOAK_REALM|KEYCLOAK_OPS_USER|KEYCLOAK_OPS_PASSWORD)
        [ -n "${!key:-}" ] || export "$key=$value" ;;
    esac
  done < "$ENV_FILE"
else
  warn "$ENV_FILE not found — relying on the environment"
fi

REALM="${KEYCLOAK_REALM:-stigvidd}"
OPS_USER="${KEYCLOAK_OPS_USER:-${KC_ADMIN_USER:-}}"
if [ -z "$OPS_USER" ] || [ -z "${KEYCLOAK_OPS_PASSWORD:-${KC_ADMIN_PASSWORD:-}}" ]; then
  die "set KEYCLOAK_OPS_USER and KEYCLOAK_OPS_PASSWORD, or KC_ADMIN_USER and KC_ADMIN_PASSWORD, in .env or the environment"
fi
# Exported under the name kcadm reads it from, and passed into the container by NAME
# only (`exec -e KC_CLI_PASSWORD`, no `=value`), which keeps it out of every argv.
export KC_CLI_PASSWORD="${KEYCLOAK_OPS_PASSWORD:-${KC_ADMIN_PASSWORD:-}}"

# kcadm keeps its access token in a config file; a private one in the container's
# /tmp, removed on exit, so no token outlives the run.
KCADM_CONFIG="/tmp/kcadm-events-$$.config"
kcadm() {
  "${COMPOSE_CMD[@]}" exec -T -e KC_CLI_PASSWORD keycloak \
    /opt/keycloak/bin/kcadm.sh "$@" --config "$KCADM_CONFIG"
}
cleanup() {
  "${COMPOSE_CMD[@]}" exec -T keycloak rm -f "$KCADM_CONFIG" >/dev/null 2>&1 || true
}
trap cleanup EXIT

log "Signing in to Keycloak (master realm) as ${OPS_USER}"
kcadm config credentials --server http://localhost:8080 --realm master --user "$OPS_USER" >/dev/null \
  || die "kcadm could not sign in — is the keycloak service running, and are the credentials right?"

realm_state() {
  kcadm get "realms/${REALM}" --fields eventsEnabled,eventsListeners,adminEventsEnabled
}

before=$(realm_state) || die "could not read realm '${REALM}' — check KEYCLOAK_REALM"

# One parse, three answers: the current listeners, whether the DB store is on, and
# the listener list to write. Order is kept and nothing is removed.
mapfile -t parsed < <(printf '%s' "$before" | python3 -c '
import json, sys
realm = json.load(sys.stdin)
listeners = list(realm.get("eventsListeners") or [])
wanted = listeners + ([] if "jboss-logging" in listeners else ["jboss-logging"])
print(",".join(listeners))
print("true" if realm.get("eventsEnabled") else "false")
print(json.dumps(wanted, separators=(",", ":")))
print("true" if realm.get("adminEventsEnabled") else "false")
')
[ "${#parsed[@]}" -eq 4 ] || die "could not parse the realm representation"
current_listeners=${parsed[0]}
events_enabled=${parsed[1]}
wanted_listeners=${parsed[2]}
admin_events_enabled=${parsed[3]}

log "Realm '${REALM}' now: eventsListeners=[${current_listeners}] eventsEnabled=${events_enabled} adminEventsEnabled=${admin_events_enabled}"

case ",${current_listeners}," in
  *,jboss-logging,*) has_listener=1 ;;
  *) has_listener=0 ;;
esac

if [ "$has_listener" -eq 1 ] && [ "$events_enabled" = "false" ]; then
  log "Nothing to do: jboss-logging is a listener and no events are stored."
  exit 0
fi

if [ "$DRY_RUN" -eq 1 ]; then
  log "Dry run. Would set: eventsListeners=${wanted_listeners} eventsEnabled=false"
  exit 0
fi

kcadm update "realms/${REALM}" -s eventsEnabled=false -s "eventsListeners=${wanted_listeners}" \
  || die "could not update realm '${REALM}'"

after=$(realm_state) || die "could not re-read realm '${REALM}'"
log "Realm '${REALM}' after:"
printf '%s\n' "$after"

if [ "$events_enabled" = "true" ]; then
  warn "events were being STORED until now. Those already in the database stay until"
  warn "the realm's event expiration, and ride along in every backup meanwhile. To remove"
  warn "them now: Realm settings -> Events -> User events settings -> Clear user events."
fi
if [ "$admin_events_enabled" = "true" ]; then
  warn "adminEventsEnabled is true: ADMIN events are still stored in the database."
  warn "This script does not change that; it is a separate decision."
fi
