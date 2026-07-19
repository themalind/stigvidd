#!/usr/bin/env bash
#
# Migrate a Stigvidd docker-compose environment between hosts.
#
# Stateful data in the stack lives in two named volumes:
#   - <project>_pgdata : the Postgres/PostGIS database
#   - <project>_media  : uploaded images (served by the WebDAV media service)
# This script backs both up into a single tarball and restores them on the
# target. Both hosts run the same images, so it's a byte-for-byte copy — no
# logical dump/restore needed.
#
# (Config that is NOT data — docker-compose.yml, db/, and especially .env with
#  its secrets — must be copied to the target separately; see the flow below.)
#
# Usage:
#   ./scripts/migrate.sh backup  [outfile.tar.gz]      # on the SOURCE host
#   ./scripts/migrate.sh restore <infile.tar.gz>       # on the TARGET host
#
# Typical flow:
#   # source host, in the compose dir:
#   ./scripts/migrate.sh backup stigvidd-data.tar.gz
#   scp stigvidd-data.tar.gz .env docker-compose.yml  target:/opt/stigvidd/
#   scp -r db                                          target:/opt/stigvidd/
#   # target host, in /opt/stigvidd:
#   docker login inkaben.se
#   ./scripts/migrate.sh restore stigvidd-data.tar.gz
#   docker compose pull && docker compose up -d
#
set -euo pipefail

# Compose project name (see `name:` in docker-compose.yml) -> volume prefix.
PROJECT="${COMPOSE_PROJECT_NAME:-stigvidd}"
VOLUMES=(pgdata media)

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
