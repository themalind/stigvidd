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
secrets**, which on most boxes point at something you did not mean to migrate.

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

Related: the `attribute-failure` skill is the general form of the trap here — a red signal that
names something far from its cause. See also `verify-in-docker` for when the whole stack is the
right instrument instead, and [[mail-templates-seeded-with-insertdata]] for the seeding rule the
sequence check above exists to confirm.
