#!/usr/bin/env bash
#
# One-time import of existing media from a (legacy/external) WebDAV server into
# the stack's `media` volume.
#
# Use this when moving off the old external WebDAV: the host-to-host migration
# (scripts/migrate.sh) copies the `media` VOLUME, but on the very first cutover
# that volume is empty — the images still live on the old server. This script
# pulls them in. Run it once, then migrate.sh carries the volume thereafter.
#
# It runs rclone in a throwaway container (nothing to install on the host),
# copies recursively (trails/, facilities/, reviews/, symbols/, ...), and
# chowns the result to the nginx worker uid so the media service can serve the
# files AND write new uploads into the existing folders.
#
# Usage:
#   SRC_URL=https://old-host/dav/ SRC_USER=stigvidd SRC_PASS=secret \
#     ./scripts/import-media.sh
#
#   # or with flags:
#   ./scripts/import-media.sh --url https://old-host/dav/ --user stigvidd --pass secret
#
# Options:
#   --url URL       source WebDAV base URL (or env SRC_URL)
#   --user USER     source WebDAV username (or env SRC_USER)
#   --pass PASS     source WebDAV password (or env SRC_PASS)
#   --vendor V      rclone webdav vendor: other|nextcloud|owncloud|sharepoint (default: other)
#   --volume NAME   target docker volume (default: <project>_media)
#   --dry-run       list what would be transferred, copy nothing
#
set -euo pipefail

PROJECT="${COMPOSE_PROJECT_NAME:-stigvidd}"
VOLUME="${PROJECT}_media"
VENDOR="other"
DRYRUN=""
# nginx worker uid:gid in the media image (nginx:alpine).
NGINX_UID=101
NGINX_GID=101

SRC_URL="${SRC_URL:-}"
SRC_USER="${SRC_USER:-}"
SRC_PASS="${SRC_PASS:-}"

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31mError:\033[0m %s\n' "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --url)     SRC_URL="$2"; shift 2;;
    --user)    SRC_USER="$2"; shift 2;;
    --pass)    SRC_PASS="$2"; shift 2;;
    --vendor)  VENDOR="$2"; shift 2;;
    --volume)  VOLUME="$2"; shift 2;;
    --dry-run) DRYRUN="1"; shift;;
    -h|--help) sed -n '2,40p' "$0"; exit 0;;
    *) die "unknown argument: $1";;
  esac
done

command -v docker >/dev/null || die "docker not found on PATH"
[ -n "$SRC_URL" ]  || die "source WebDAV URL required (--url or SRC_URL)"
[ -n "$SRC_USER" ] || die "source WebDAV username required (--user or SRC_USER)"
[ -n "$SRC_PASS" ] || die "source WebDAV password required (--pass or SRC_PASS)"

docker volume inspect "$VOLUME" >/dev/null 2>&1 \
  || die "target volume '$VOLUME' does not exist (start the stack once, or 'docker volume create $VOLUME')"

if [ -n "$DRYRUN" ]; then
  log "DRY RUN — listing source, copying nothing"
  RCLONE_ARGS="copy --dry-run"
else
  log "Importing media from $SRC_URL -> volume '$VOLUME'"
  RCLONE_ARGS="copy"
fi

# rclone in a throwaway alpine container. `config create` obscures the password
# for us; the remote is then referenced as 'src:'. The source connection values
# are passed via env so they never appear in `ps`/image layers.
docker run --rm \
  -v "$VOLUME":/data \
  -e SRC_URL -e SRC_USER -e SRC_PASS -e VENDOR \
  alpine sh -euc '
    apk add --no-cache rclone >/dev/null
    rclone config create src webdav \
      url="$SRC_URL" vendor="$VENDOR" user="$SRC_USER" pass="$SRC_PASS" >/dev/null
    rclone '"$RCLONE_ARGS"' "src:" /data --transfers=8 --checkers=16 --stats=5s -v
  '

if [ -z "$DRYRUN" ]; then
  log "Fixing ownership so the media server can serve and write these files..."
  docker run --rm -v "$VOLUME":/data alpine \
    chown -R "${NGINX_UID}:${NGINX_GID}" /data
  log "Done. Verify with:  docker compose up -d media && curl -I <PresentableBaseUrl>/<some/known/file>"
fi
