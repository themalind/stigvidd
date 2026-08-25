#!/usr/bin/env bash
#
# Migrate a Stigvidd docker-compose environment between hosts.
#
# Stateful data in the stack lives in five named volumes:
#   - <project>_pgdata        : the Postgres/PostGIS database
#   - <project>_media         : uploaded images (served by the WebDAV media service)
#   - <project>_maildata      : mailboxes
#   - <project>_mailstate     : Rspamd/Redis/fail2ban state (bayes training etc.)
#   - <project>_trail_imports : uploaded trail-import source files. Stateful because a
#                               review session is re-analysed from the file it was created
#                               from, days after the upload — see TrailImport__StoragePath
#                               in docker-compose.yml.
# This script backs them all up into a single tarball and restores them on the
# target. Both hosts run the same images, so it's a byte-for-byte copy — no
# logical dump/restore needed. (<project>_maillogs is deliberately excluded.)
#
# (Config that is NOT data — docker-compose.yml, db/, and especially .env,
#  mail-config/ and db-certs/ with their secrets — must be copied to the target
#  separately; see the flow below. db-certs/ holds the Postgres server key for
#  the published 5432: copy it, or regenerate it on the target with
#  scripts/db-cert.sh. `db` will not START without it.)
#
# KEEP THIS LIST IN STEP WITH docker-compose.yml. A named volume that is missing here is
# not an error and produces no output: mount_args() only warns about volumes it was told
# to look for, so an omitted one is copied nowhere and the migration still reports
# success. The loss surfaces later, on the target, when something reads data that was
# never carried over.
#
# (Config that is NOT data — docker-compose.yml, db/, and especially .env and
#  mail-config/ with their secrets — must be copied to the target separately;
#  see the flow below.)
#
# Usage:
#   ./scripts/migrate.sh backup  [outfile.tar.gz]      # on the SOURCE host
#   ./scripts/migrate.sh restore <infile.tar.gz>       # on the TARGET host
#
# Typical flow:
#   # source host, in the compose dir:
#   ./scripts/migrate.sh backup stigvidd-data.tar.gz
#   scp stigvidd-data.tar.gz .env docker-compose.yml  target:/opt/stigvidd/
#   scp -r db db-certs mail-config                     target:/opt/stigvidd/
#   # target host, in /opt/stigvidd:
#   docker login inkaben.se
#   ./scripts/migrate.sh restore stigvidd-data.tar.gz
#   docker compose pull && docker compose up -d
#
set -euo pipefail

# Compose project name (see `name:` in docker-compose.yml) -> volume prefix.
PROJECT="${COMPOSE_PROJECT_NAME:-stigvidd}"
# A volume this host does not have yet is skipped automatically, with a warning — see
# mount_args(). That covers hosts predating the mailserver service (mail*) and hosts
# predating trail import (trail_imports), so listing a volume here is safe on older hosts
# and omitting one is not.
VOLUMES=(pgdata media maildata mailstate trail_imports)

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mwarn:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31mError:\033[0m %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null || die "docker not found on PATH"

volume_exists() { docker volume inspect "${PROJECT}_$1" >/dev/null 2>&1; }
volume_empty()  { [ -z "$(docker run --rm -v "${PROJECT}_$1":/v alpine sh -c 'ls -A /v')" ]; }

# Build the `-v vol:/vols/<name>` args for the volumes that actually exist.
mount_args() {
  local mode="$1"; shift
  local args=()
  for v in "${VOLUMES[@]}"; do
    if volume_exists "$v"; then
      args+=(-v "${PROJECT}_${v}:/vols/${v}${mode}")
    else
      warn "volume '${PROJECT}_${v}' not found — skipping"
    fi
  done
  [ "${#args[@]}" -gt 0 ] || die "no known volumes exist on this host"
  printf '%s\n' "${args[@]}"
}

backup() {
  local out="${1:-${PROJECT}-data-$(date -u +%Y%m%dT%H%M%SZ).tar.gz}"

  # Stop the stack so the snapshot is consistent (no mid-write DB pages).
  log "Stopping the stack for a consistent snapshot..."
  docker compose stop >/dev/null 2>&1 || true

  mapfile -t MOUNTS < <(mount_args ":ro")
  log "Archiving volumes [${VOLUMES[*]}] -> $out"
  docker run --rm "${MOUNTS[@]}" -v "$(pwd)":/backup alpine \
    tar czf "/backup/$(basename "$out")" -C /vols .

  log "Done. Backup written to: $out"
  log "Copy it, plus .env / docker-compose.yml / db/, to the target host."
  log "Restart here with: docker compose up -d"
}

restore() {
  local in="${1:?usage: migrate.sh restore <infile.tar.gz>}"
  [ -f "$in" ] || die "backup file '$in' not found"

  # Refuse to clobber existing non-empty data.
  for v in "${VOLUMES[@]}"; do
    if volume_exists "$v" && ! volume_empty "$v"; then
      die "volume '${PROJECT}_${v}' already exists and is NOT empty. Refusing to overwrite.
     To replace it: docker compose down && docker volume rm ${PROJECT}_${v} , then re-run."
    fi
  done

  docker compose down >/dev/null 2>&1 || true
  for v in "${VOLUMES[@]}"; do docker volume create "${PROJECT}_${v}" >/dev/null; done

  mapfile -t MOUNTS < <(mount_args "")
  log "Restoring $in -> volumes [${VOLUMES[*]}]"
  docker run --rm "${MOUNTS[@]}" -v "$(pwd)":/backup alpine \
    sh -c "cd /vols && tar xzf /backup/$(basename "$in")"

  log "Restore complete."
  log "Bring the stack up with: docker compose pull && docker compose up -d"
  log "(the API finds the schema already migrated and starts normally)"
}

case "${1:-}" in
  backup)  shift; backup "$@";;
  restore) shift; restore "$@";;
  *) die "usage: $0 {backup [outfile]|restore <infile>}";;
esac
