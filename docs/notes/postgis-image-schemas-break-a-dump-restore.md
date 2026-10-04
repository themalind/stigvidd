<!--
SPDX-FileCopyrightText: 2026 The Stigvidd Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Restoring a pg_dump into a database the postgis image created fails on `schema "tiger" already exists`

The `postgis/postgis` image's init script installs more than `postgis` into `POSTGRES_DB`:
it also installs `fuzzystrmatch`, `postgis_tiger_geocoder` and `postgis_topology`, which
creates the schemas `tiger`, `tiger_data` and `topology`. Production's and staging's
`stigvidd` database is `POSTGRES_DB`, so both have them.

`pg_dump` of that database writes those schemas as plain statements, with no `IF NOT EXISTS`:

```sql
CREATE SCHEMA tiger;
CREATE SCHEMA tiger_data;
CREATE SCHEMA topology;
CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder WITH SCHEMA tiger;
```

Restoring that into another `POSTGRES_DB` therefore fails on the first line:

```text
psql:restore.sql:33: ERROR:  schema "tiger" already exists
```

## Why a test database hides it

A database made by hand (`CREATE DATABASE dst`, or `createdb`) comes from `template1`, which
the image does **not** touch. So it has no `tiger`. Measured 2026-10-04 on
`postgis/postgis:17-3.5`:

- the first import into such a database succeeds;
- the *second* import into the same database fails;
- an import into the image's own `POSTGRES_DB` fails on the first attempt.

That last case is exactly a staging host's first refresh from production. A green run against a
hand-made database proves nothing about it.

## What the restore does about it

[`DataTransferService.RestoreAppDatabaseAsync`](../../backend/Core/Services/DataTransferService.cs)
first turns the dump into SQL with `pg_restore -f`. It collects every `CREATE SCHEMA` line and
emits a `DROP SCHEMA IF EXISTS … CASCADE` for each. It then runs that prelude and the dump in a
single `psql --single-transaction -v ON_ERROR_STOP=1`.

Dropping `tiger` or `topology` cascades only to their own extensions, never to `postgis`. The
dump's `CREATE EXTENSION IF NOT EXISTS` then puts them back. `postgis` itself is never dropped,
so the API's cached type OIDs stay valid.

The same prelude drops `public."__EFMigrationsHistory"`. EF keeps that table in `public`, **not**
in `dbo`, despite `HasDefaultSchema("dbo")`, so `DROP SCHEMA dbo CASCADE` alone leaves it behind
and the restore's `CREATE TABLE` collides.

Related: [[pg-client-must-match-the-postgis-server-major]],
[[verifying-a-migration-outside-compose-needs-the-pinned-postgis-major]].
