# syntax=docker/dockerfile:1
#
# Reverse proxy: Caddy with the stack's Caddyfile baked in. Domains + ACME
# email are supplied via env at runtime, so one image works on any host.
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
EXPOSE 80 443
