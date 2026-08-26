#!/usr/bin/env bash
#
# Generate the TLS server certificate the `db` service needs.
#
# docker-compose.yml starts Postgres with `-c ssl=on`, which makes it REFUSE TO
# START unless both files below exist and the key's ownership/mode satisfy it.
# So this has to be run once per host, BEFORE the first `docker compose up -d db`:
#
#   ./scripts/db-cert.sh stigvidd.se        # on the deploy host
#   ./scripts/db-cert.sh localhost          # for a local stack
#
# It writes ./db-certs/{server.crt,server.key} — a bind mount, not a named
# volume, so `scripts/migrate.sh` does NOT carry it. Treat it exactly like
# mail-config/: gitignored, copied to a new host by hand (or regenerated there,
# which is just as good — the cert is self-signed and carries no trust anyone
# else depends on).
#
# Why the ownership dance: Postgres rejects a key file that is group- or
# world-readable *unless* the file is owned by root and no more permissive than
# 0640. Inside postgis/postgis:17-3.5 the server runs as uid 999 ("postgres"),
# and a bind-mounted file keeps the host's ownership — so root:999 at 0640 is the
# combination that works for a mount, and it is the detail that gets fumbled by
# hand. The alternative (999:999 at 0600) needs the host to have that uid.
#
# Self-signed means clients connect with sslmode=require (encrypted, no identity
# check), not verify-full. That stops passive sniffing of queries and results,
# which is the point; a publicly-trusted cert for the database is a separate job
# (see DEPLOYMENT.md, "Direct database access").
set -euo pipefail

CERT_DIR="${DB_CERT_DIR:-./db-certs}"
DAYS="${DB_CERT_DAYS:-3650}"
# uid:gid the key must end up owned by. 999 is postgres inside the image.
KEY_OWNER="${DB_CERT_KEY_OWNER:-0:999}"

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mwarn:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31mError:\033[0m %s\n' "$*" >&2; exit 1; }

usage() {
  cat >&2 <<'USAGE'
Usage: ./scripts/db-cert.sh <hostname> [--force]

  <hostname>   the name clients connect to (e.g. stigvidd.se, localhost).
               Used as the certificate CN and subjectAltName.
  --force      overwrite an existing certificate.

Env overrides: DB_CERT_DIR (./db-certs), DB_CERT_DAYS (3650),
               DB_CERT_KEY_OWNER (0:999)
USAGE
  exit 2
}

HOSTNAME_ARG=""
FORCE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --force) FORCE=1 ;;
    -h|--help) usage ;;
    -*) die "unknown option: $1" ;;
    *) [ -z "$HOSTNAME_ARG" ] || die "unexpected argument: $1"; HOSTNAME_ARG="$1" ;;
  esac
  shift
done

[ -n "$HOSTNAME_ARG" ] || usage
command -v openssl >/dev/null || die "openssl not found on PATH"

CRT="$CERT_DIR/server.crt"
KEY="$CERT_DIR/server.key"

if [ -e "$CRT" ] || [ -e "$KEY" ]; then
  [ "$FORCE" -eq 1 ] || die "$CERT_DIR already holds a certificate — pass --force to replace it (db must be recreated afterwards)"
  warn "overwriting the existing certificate in $CERT_DIR"
fi

mkdir -p "$CERT_DIR"

log "Generating a self-signed certificate for '$HOSTNAME_ARG', valid $DAYS days"
# -addext keeps CN and SAN in step; a SAN-less cert is rejected outright by some
# clients even at sslmode=require.
openssl req -x509 -nodes -newkey rsa:2048 -sha256 -days "$DAYS" \
  -subj "/CN=$HOSTNAME_ARG" \
  -addext "subjectAltName=DNS:$HOSTNAME_ARG" \
  -addext "basicConstraints=critical,CA:FALSE" \
  -addext "keyUsage=critical,digitalSignature,keyEncipherment" \
  -addext "extendedKeyUsage=serverAuth" \
  -keyout "$KEY" -out "$CRT" 2>/dev/null

chmod 644 "$CRT"
chmod 640 "$KEY"

# Postgres reads the key as uid 999; root:999 0640 is what a bind mount can
# offer without the host needing a postgres user. Needs privilege, so it is a
# warning rather than a failure when running unprivileged (a local stack often
# does not need it — see the note below).
if chown "$KEY_OWNER" "$KEY" 2>/dev/null; then
  log "key owned by $KEY_OWNER, mode 640"
else
  warn "could not chown '$KEY' to $KEY_OWNER (not root?)."
  warn "Postgres will refuse to start with:"
  warn "  private key file \"...\" has group or world access"
  warn "Fix with:  sudo chown $KEY_OWNER $KEY"
fi

log "Wrote:"
log "  $CRT"
log "  $KEY"
cat <<EOF

Fingerprint (compare this against what your client shows on first connect):
$(openssl x509 -in "$CRT" -noout -fingerprint -sha256)

Next: recreate the database container so it picks the certificate up.
CI never does this for you — see DEPLOYMENT.md, Part 3.

  docker compose up -d db
  docker compose exec db psql -U "\${POSTGRES_USER:-stigvidd}" -c 'show ssl'   # expect: on
EOF
