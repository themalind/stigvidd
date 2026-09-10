# Caddy reverse proxy — APP-ONLY variant, for a partial stack.
#
# Identical to `Caddyfile` minus the three site blocks whose upstreams are not
# part of a partial stack: {$AUTH_DOMAIN} (keycloak), {$OBSERVATORY_DOMAIN}
# (openobserve) and {$MAIL_DOMAIN} (the cert-only block the mailserver reads).
# Selected with CADDYFILE=/etc/caddy/Caddyfile.app — see STAGING.md.
#
# WHY A SECOND FILE RATHER THAN A CONDITIONAL. Caddy substitutes {$VAR} at load
# time but has no conditionals, and a site block whose address interpolates to
# EMPTY makes Caddy refuse its whole config — taking every other domain down
# with it. So an unwanted block cannot be switched off from .env; it has to be
# absent from the file. Keep this file in step with `Caddyfile` when the web,
# api or media blocks change — nothing checks that they agree.
#
# The three omitted names must still be SET in .env (compose interpolates the
# whole file regardless of which services you name, so ${AUTH_DOMAIN:?} is
# required even when keycloak is not started) — but on a partial stack they must
# be that stack's OWN names, never production's. The proxy publishes each
# *_DOMAIN as a network alias, so setting AUTH_DOMAIN=auth.<prod> would make
# this Caddy claim production's hostname inside the stack and swallow the API's
# calls to the real Keycloak. See STAGING.md, "Troubleshooting".

{
	email {$ACME_EMAIL}
	# Default is Let's Encrypt production. To avoid rate limits while testing,
	# set ACME_CA=https://acme-staging-v02.api.letsencrypt.org/directory
	acme_ca {$ACME_CA:https://acme-v02.api.letsencrypt.org/directory}
}

# Web frontend.
{$WEB_DOMAIN} {
	encode zstd gzip
	reverse_proxy web:80
}

# Backend API.
{$API_DOMAIN} {
	encode zstd gzip
	reverse_proxy api:8080
}

# Media (own subdomain — swap for a CDN origin later without touching the app).
# Public GETs are served; write methods still require the basic auth only the
# API holds (and the API uploads over the internal network, not through here).
{$MEDIA_DOMAIN} {
	encode zstd gzip
	reverse_proxy media:80
}
