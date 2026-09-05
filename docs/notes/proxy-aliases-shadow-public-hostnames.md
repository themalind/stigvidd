# The proxy publishes every `*_DOMAIN` as a network alias, so a stack pointed at another environment's service swallows its own request

[`docker-compose.yml`](../../docker-compose.yml)'s `proxy` service ends with this, on the
`public` network:

```yaml
    networks:
      public:
        aliases:
          - ${WEB_DOMAIN}
          - ${API_DOMAIN}
          - ${MEDIA_DOMAIN}
          - ${AUTH_DOMAIN}
          - ${OBSERVATORY_DOMAIN}
```

It is deliberate and, on a whole-stack host, right: the API's server-to-server calls to
`https://auth.<domain>` resolve to Caddy inside the stack instead of hairpinning out to the
host's public IP, and they get a valid certificate because Caddy holds it.

**The alias is unconditional.** Docker's embedded DNS answers for that name before anything
reaches a public resolver, for every container on the network — so whatever a `*_DOMAIN`
variable is set to, this stack owns that name internally.

## Where it bites

The moment a stack points at **another environment's** instance of a service it does not
run. A partial stack (see [STAGING.md](../../STAGING.md)) runs `db`, `api`, `web`, `media`,
`proxy` and borrows production's Keycloak. The intuitive `.env` is:

```ini
AUTH_DOMAIN=auth.stigvidd.se        # "the Keycloak we use"
KEYCLOAK_URL=https://auth.stigvidd.se
```

Both lines name the same host, so it reads as consistent. It is not. `AUTH_DOMAIN` aliases
`auth.stigvidd.se` onto the **staging** proxy, `proxy/Caddyfile`'s `{$AUTH_DOMAIN}` block
sends it to `keycloak:8080`, and staging runs no `keycloak`. The API's token calls to
production never leave the host.

The symptom is a connection error or a 502 from a configuration where every value is
individually correct, and `curl https://auth.stigvidd.se` **from the host** works fine —
the host is not on the docker network. The test that shows it is from inside a container:

```sh
docker compose exec api getent hosts auth.stigvidd.se
```

A `10.x` answer is the alias. A public IP is correct.

## The rule

`*_DOMAIN` variables mean **"names this proxy serves"**, not "names this stack talks to".
They are two different things and only one of them is what the variable is for. A stack must
set them to its own hostnames — even for services it does not run, since compose requires
the `${VAR:?}` values regardless — and reach another environment through a *separate*
variable (`KEYCLOAK_URL`, `OTLP_ENDPOINT`) that is never aliased.

The paired change is [`proxy/Caddyfile.app`](../../proxy/Caddyfile.app), selected with
`CADDYFILE=/etc/caddy/Caddyfile.app`: it omits the auth/observatory/mail site blocks so
Caddy does not additionally request certificates for three names it has no upstream for.
Caddy has no conditionals and an empty site address makes it reject its **entire** config,
so an unwanted block cannot be switched off from `.env` — it has to be absent from the file,
which is why there are two Caddyfiles rather than one.

Related: [[keycloak-realm-lives-in-appsettings-not-compose]],
[[openobserve-oss-has-no-rbac]], [[compose-volume-needs-migrate-sh]].
