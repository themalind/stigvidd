---
name: verify-in-docker
description: Verify a change by actually running the stack under docker compose — a migration, a deployment/config change, anything touching docker-compose.yml, proxy/, db/, keycloak/, a Dockerfile or scripts/. Use AFTER changing any of those and BEFORE calling that work done, because no GitHub CI job builds an image or brings the stack up.
---

# Nothing in GitHub CI runs this stack

[.github/workflows/ci.yml](../../../.github/workflows/ci.yml) has five jobs — `harness`,
`backend`, `app`, `web` and `licensing`. Not one of them builds an **image** or invokes
`docker compose`. The [Jenkinsfile](../../../Jenkinsfile) does — and only on `main`, after
the tests. So every one of these is green on a PR while broken:

- `docker-compose.yml` — a bad env var, a missing volume, a service that cannot resolve a peer
- `proxy/` (Caddy), `db/`, `keycloak/`, `media/`
- any `Dockerfile`
- `scripts/*.sh` — covered by no test and no CI stage at all
- **any migration** — the suites are SQLite in-memory and apply none of them

## Bring it up

```sh
docker compose up -d          # NEVER without -d; foreground wedges the turn
docker compose ps             # every service should be running/healthy, not restarting
```

`.claude/hooks/guard-long-running.mjs` denies a foreground `up` and a `logs -f`.

Services: `db` (PostGIS), `api`, `web`, `media` (WebDAV), `keycloak`, `openobserve`,
`proxy` (Caddy), `mailserver`.

## Then ask the right endpoint

The API has two health endpoints and they answer different questions:

| | |
| --- | --- |
| `/healthz` | liveness — the process is up. Predicate is `_ => false`, so it checks **nothing else**. |
| `/readyz` | readiness — runs the checks tagged `ready`, which includes `DatabaseHealthCheck`. |

**`/readyz` is the one that proves the database is reachable and migrated.** A green
`/healthz` with a broken database is the expected output of a bad connection string, so
quoting it as evidence proves nothing.

```sh
curl -fsS localhost:<port>/readyz
docker compose logs --tail=100 api        # --tail, not -f
```

## For a migration specifically

`DbMigrationRunner` runs `Database.MigrateAsync()` on API startup, so the interesting output
is the `api` service's log on first boot after your change:

```sh
docker compose up -d db
docker compose up -d api && docker compose logs --tail=200 api
```

A migration that throws leaves the API not-ready rather than crashing loudly, so check
`/readyz` as well as the log. If the migration writes geometry, confirm the SRID actually
landed as 4326 rather than 0 — that is the one that is silent
([srid-4326](../../../docs/notes/srid-4326.md)).

## Tearing down

```sh
docker compose down                       # keeps volumes
```

**Do not** `docker compose down -v` casually, and do not `docker volume rm` on a machine
that might be a real host. The stateful volumes are `pgdata`, `media`, `maildata`,
`mailstate` and **`trail_imports`** (uploaded import sources, re-read days after the
upload), and [scripts/migrate.sh](../../../scripts/migrate.sh) exists because they are what a
host migration has to carry. `DEPLOYMENT.md` is the runbook.

**A new named volume in `docker-compose.yml` is a change to `migrate.sh` as well** — its
`VOLUMES=(...)` is hand-maintained, an omitted volume is silently carried nowhere, and no CI
runs that script at all. See
[compose-volume-needs-migrate-sh](../../../docs/notes/compose-volume-needs-migrate-sh.md),
including how to test a change to it without touching a real stack.
