# syntax=docker/dockerfile:1
#
# Reverse proxy: Caddy with the stack's Caddyfile baked in. Domains + ACME
# email are supplied via env at runtime, so one image works on any host.
FROM caddy:2-alpine
# Both configs ship in every image; compose picks one with CADDYFILE.
# Caddyfile     — the whole stack: web, api, media, auth, observatory, mail.
# Caddyfile.app — web/api/media only, for a partial stack (see STAGING.md).
COPY Caddyfile /etc/caddy/Caddyfile
COPY Caddyfile.app /etc/caddy/Caddyfile.app
EXPOSE 80 443
