<!--
SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Applying migrations to a hand-started PostGIS fails in a 2026-05 migration unless you match the pinned major

No test applies a migration, so checking one for real means a real PostgreSQL. When the full
stack is not available — no `.env`, or the host runs podman-compose rather than Docker Compose —
the obvious substitute is one container plus `dotnet ef database update`:

```sh
docker run -d --name pg -e POSTGRES_PASSWORD=pw -e POSTGRES_DB=stigvidd \
  -p 55433:5432 postgis/postgis:17-3.5           # the tag is NOT optional, see below

cd backend && dotnet ef database update --project Infrastructure \
  --connection "Host=localhost;Port=55433;Database=stigvidd;Username=postgres;Password=pw"
```

`--connection` matters too: `DesignTimeDbContextFactory` otherwise reads Infrastructure's **user
secrets**, which on most boxes point at something you did not mean to migrate. It also writes
nothing to the machine, which the user-secrets route does — and the integration suite inherits
that same store, so a value left there changes the suite's behaviour on your box and nowhere
else ([[integration-tests-inherit-api-config]]).

**Do not gate the wait on `pg_isready`.** The postgres entrypoint runs `initdb` and serves a
temporary local server *before* it creates `POSTGRES_DB`, so `pg_isready -d stigvidd` returns
ready and the next command still dies with `FATAL: database "stigvidd" does not exist`.
Measured 2026-09-19. Wait on a real query instead:

```sh
until docker exec pg psql -U postgres -d stigvidd -tAc 'SELECT 1' >/dev/null 2>&1; do sleep 1; done
```

## The failure that looks like a broken migration and is not

Reach for any other PostGIS tag — `postgis/postgis:16-3.4` is the natural pick — and the run dies
here:

```
Applying migration '20260523120007_PostGIS'.
Npgsql.PostgresException: 42601: syntax error at or near "COLUMNS"
POSITION: 194
```

Nothing in that output says "wrong server version". It names a migration from **May 2026** that
has applied cleanly in production for months, at a character position, in a file you did not
touch — so it reads as a genuine pre-existing defect you have just uncovered, or as your own
change having somehow corrupted the chain. It is neither: `COLUMNS` there is
PostgreSQL **17** syntax, and the server is 16.

[`docker-compose.yml`](../../docker-compose.yml) pins `postgis/postgis:17-3.5`, and that pin is
load-bearing for the migration chain, not just a preference. Match it exactly.

## What this is worth checking for

Once it applies, a hand-started database answers the questions the suite cannot, and they are
quick:

```sh
docker exec pg psql -U postgres -d stigvidd -c '\d dbo."<YourTable>"'   # columns, indexes, FKs
docker exec pg psql -U postgres -d stigvidd -tAc 'SELECT last_value FROM dbo."MailTemplates_Id_seq";'
```

That sequence check is the one worth remembering: it is how you confirm a
`migrationBuilder.InsertData` seed left the identity sequence **ahead** of the data, which is the
whole reason [[mail-templates-seeded-with-insertdata]] says to omit `Id`. Rolling back one step
(`dotnet ef database update <PreviousMigration> --project Infrastructure --connection …`) also
exercises `Down`, which nothing else ever runs.

## A backfill is invisible unless you seed the OLD schema first

Everything above applies the whole chain to an empty database. That proves the DDL and says
**nothing** about a `migrationBuilder.Sql` backfill, because a backfill only ever touches rows
that predate it — and a fresh database has none. Run it that way and it reports success having
updated zero rows, which looks identical to working.

Stop one migration short, seed rows shaped the way production's already are, then apply the one
under test:

```sh
dotnet ef database update <PreviousMigrationId> --project Infrastructure --connection "$CONN"
docker exec pg psql -U postgres -d stigvidd -c 'INSERT INTO dbo."<Table>" (...) VALUES (...);'
dotnet ef database update --project Infrastructure --connection "$CONN"
```

Measured 2026-09-19 for `20260919110806_AddMailOutboxRetention`, whose `Up` ends in
`UPDATE dbo."OutboxEmails" SET "SettledAt" = "LastUpdatedAt" WHERE "Status" IN (3, 4)`: four
seeded rows, and afterwards the two settled ones carried `SettledAt` while the `Pending` and
`Sent` ones were untouched. Without that seed the migration was green and the assertion did not
exist. The stakes are that a retention sweep spares a row whose timestamp is null, so a backfill
that silently did nothing would leave every pre-existing row immortal — the exact rows the rule
was written for.

## Two semantics only a real Postgres can settle

Both suites are SQLite, and these are where the engines differ, so a predicate meant for
production is worth one `psql` round here:

Quote these with **double** quotes outside and backslash-escaped double quotes inside. The
SQL contains single quotes, so the single-quoted form the examples above use will not close;
and Postgres' own `$$` dollar-quoting is not available here either, because `$$` is the
shell's PID before `psql` ever sees it.

```sh
# NULL in a comparison is neither true nor false: a 90-day-old row with a null timestamp
# must be SPARED by "< cutoff", not matched. Expect zero rows.
docker exec pg psql -U postgres -d stigvidd -c \
  "SELECT \"Identifier\" FROM dbo.\"OutboxEmails\" WHERE \"SettledAt\" < now() - interval '30 days';"

# Postgres lower() is locale-aware, SQLite's is ASCII-only -- so a case-folded match that
# passes the suite can still miss in production. Keep fixtures ASCII either way.
docker exec pg psql -U postgres -d stigvidd -c \
  "SELECT \"Identifier\" FROM dbo.\"OutboxEmails\" WHERE lower(\"ToAddress\") = 'e@example.com';"
```

Related: the `attribute-failure` skill is the general form of the trap here — a red signal that
names something far from its cause. See also `verify-in-docker` for when the whole stack is the
right instrument instead, and [[mail-templates-seeded-with-insertdata]] for the seeding rule the
sequence check above exists to confirm.
