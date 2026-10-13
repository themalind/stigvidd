# syntax=docker/dockerfile:1
#
# Reverse proxy: Caddy with the stack's Caddyfile baked in. Domains + ACME
# email are supplied via env at runtime, so one image works on any host.
FROM caddy:2-alpine
# Both configs ship in every image; compose picks one with CADDYFILE.
# Caddyfile     — the whole stack: web, api, media, auth, observatory, mail.
# Caddyfile.app — web/api/media only, for a partial stack (see STAGING.md).
# Caddyfile.behind-proxy — Caddyfile.app over plain HTTP, for a host whose own
#   reverse proxy terminates TLS (docker-compose.behind-proxy.yml).
COPY Caddyfile /etc/caddy/Caddyfile
COPY Caddyfile.app /etc/caddy/Caddyfile.app
COPY Caddyfile.behind-proxy /etc/caddy/Caddyfile.behind-proxy
EXPOSE 80 443
