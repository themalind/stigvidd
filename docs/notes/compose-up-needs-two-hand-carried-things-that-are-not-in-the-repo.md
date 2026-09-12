# `docker compose up -d` cannot work on a fresh checkout, and the second blocker reports a certificate rather than a missing directory

The `verify-in-docker` skill and CLAUDE.md both treat `docker compose up -d` as the way to
verify a stack change. On a checkout that has never been a deploy host it cannot run at all,
and the two reasons surface very differently.

## 1. No `.env` — loud, and obvious

Interpolation fails before anything starts:

```
ValueError: required variable POSTGRES_PASSWORD is missing a value: POSTGRES_PASSWORD must be set
```

`.env` is gitignored and carried by hand (CLAUDE.md, "Secrets"). The workaround for anything
that only needs the file to *interpolate* — validating a compose edit, building an image — is
the placeholder set CI already keeps:

```sh
docker compose --env-file ci/build.env config      # resolves every ${VAR:?...}
docker compose --env-file ci/build.env build api   # measured: builds clean
```

That is enough to prove a new `${VAR:?...}` reference will not break the Jenkins
**Build & Push images** stage, which interpolates the whole file for services it never builds.
Add the variable to [`ci/build.env`](../../ci/build.env) if it is not already there.

## 2. No `./db-certs` — quiet, and misdirecting

Past interpolation, `db` restart-loops. The log names a file, not the mount:

```
FATAL:  could not load server certificate file "/etc/postgresql/certs/server.crt":
        No such file or directory
LOG:  database system is shut down
```

`docker-compose.yml` starts Postgres with `-c ssl=on -c ssl_cert_file=…`, and the certs arrive
through `- ./db-certs:/etc/postgresql/certs:ro` — a bind mount that "holds a private key, is
gitignored, and is carried by hand between hosts like `mail-config/`", per its own comment.

The misdirection is that a **bind mount of a path that does not exist is not an error**: the
container starts, the directory is simply empty, and the only symptom is Postgres exiting on a
missing file inside it. `docker ps` shows `Up Less than a second (starting)` on every poll,
which reads like a slow boot rather than a crash loop. Nothing anywhere says "you are missing
`./db-certs`".

There is no placeholder for this one — a self-signed pair would work, but nothing in the repo
generates it, so on a fresh box the stack stops here.

## What to verify instead, when the stack is out of reach

For a **migration**, the part that no test covers is the hand-written SQL in the migration
body, and that needs only Postgres — not the stack:

```sh
docker run -d --rm --name pgtest -e POSTGRES_PASSWORD=pw -e POSTGRES_DB=stigvidd \
  -p 55432:5432 postgis/postgis:17-3.5
cd backend && dotnet ef database update --project Infrastructure \
  --connection "Host=localhost;Port=55432;Database=stigvidd;Username=postgres;Password=pw"
```

`--connection` means no user secrets are involved. Rolling back with
`dotnet ef database update <PreviousMigrationName> --connection …` and re-applying is what
actually exercises a **backfill** `migrationBuilder.Sql`, which is otherwise unreachable:
the suites are SQLite/InMemory and use `EnsureCreated`, so no test in the repo applies a
migration at all. Measured this way — a row inserted before the migration got its own
`CreatedAt` rather than `now()`.

Related: [[compose-volume-needs-migrate-sh]], [[integration-tests-inherit-api-config]].
