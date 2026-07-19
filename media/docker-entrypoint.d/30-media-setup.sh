#!/bin/sh
# Runs (as root) via the stock nginx image's entrypoint before nginx starts.
# Generates the WebDAV basic-auth file from env and makes the data dir writable
# by the nginx worker user.
set -e

: "${WEBDAV_USER:?WEBDAV_USER is required}"
: "${WEBDAV_PASSWORD:?WEBDAV_PASSWORD is required}"

# nginx supports the RFC 2307 {PLAIN} scheme in auth_basic_user_file. The file
# is internal to the container; the same secret already lives in .env.
# Must be readable by the nginx WORKER user (not just root), or basic-auth
# checks fail with 500.
printf '%s:{PLAIN}%s\n' "$WEBDAV_USER" "$WEBDAV_PASSWORD" > /etc/nginx/dav.htpasswd
chown nginx:nginx /etc/nginx/dav.htpasswd
chmod 640 /etc/nginx/dav.htpasswd

# /data top-level must be writable so the worker can create subdirs (trails/,
# facilities/, ...). /data/.tmp holds PUT request bodies: it MUST live on the
# same filesystem as the media root, otherwise nginx's rename() into place
# fails with a cross-device-link error (500) on every upload — which happens
# whenever /data is a mounted volume. Files/subdirs the worker creates are
# owned by it; restored content keeps its original ownership.
mkdir -p /data/.tmp
chown nginx:nginx /data /data/.tmp
