---
name: add-a-migration
description: Add, change or remove an EF Core migration in backend/Infrastructure/Migrations. Use BEFORE running `dotnet ef`, and whenever a migration you scaffolded is empty, contains changes you did not make, or fails to apply. Covers the invocation that works, the file EF owns, and the fact that no test applies a migration.
---

# Adding a migration

## The invocation

```sh
cd backend
dotnet tool restore                 # dotnet-ef 10.0.9, pinned in backend/dotnet-tools.json
dotnet ef migrations add <Name> --project Infrastructure
```

`--project Infrastructure` is **required**. Without it, `dotnet ef` from `backend/` exits
with "No project was found. Change the current working directory or use the --project
option." — measured in this tree. No `--startup-project` is needed:
[`Infrastructure/Data/DesignTimeDbContextFactory.cs`](../../../backend/Infrastructure/Data/DesignTimeDbContextFactory.cs)
supplies the context, and it reads the connection string from Infrastructure's **user
secrets** (`UserSecretsId` is in `Infrastructure.csproj`). `migrations add` does not
connect, so a missing secret does not matter there; `database update` does.

`.claude/hooks/guard-build-commands.mjs` denies a `dotnet ef` without `--project`.

## What EF owns and you do not

| file | |
| --- | --- |
| `<timestamp>_<Name>.cs` | **yours to edit** — `Up`/`Down`, including raw SQL |
| `<timestamp>_<Name>.Designer.cs` | EF's. Do not touch. |
| `StigViddDbContextModelSnapshot.cs` | EF's, and the dangerous one |

The snapshot is EF's record of the model. Edit it by hand and the next
`dotnet ef migrations add` diffs against **your edit** rather than against the real
schema — silently, because it compiles either way, and the migration it then produces is
wrong in a way nothing reports. `.claude/hooks/guard-generated-files.mjs` denies edits to
both of EF's files and warns on a migration body.

If the scaffolded migration is wrong, do not patch the snapshot:

```sh
dotnet ef migrations remove --project Infrastructure
```

## Hand-written SQL is normal here

The `*PostGIS*` migrations contain hand-written `ST_SetSRID(ST_MakeLine(ST_MakePoint(...)),
4326)` backfills. Editing a migration body to add SQL is expected — but only while the
migration is **scaffolded and unapplied**. An applied migration is already recorded in
`__EFMigrationsHistory` on every database that has it and will never re-run; changing its
body then means two databases with the same migration list and different schemas. Add a new
migration instead.

## Read the SQL before you trust the scaffold

```sh
dotnet ef migrations script <previous> <yours> --project Infrastructure -o /tmp/mig.sql
```

No connection needed — `migrations script` does not even accept `--connection` (only
`database update` does) — and it is the only thing that shows what will actually run. Worth the
step every time, because an `AlterColumn` can silently emit **nothing**: `oldNullable`
defaults to `false`, so `nullable: false` on its own reads as "unchanged" and the `SET NOT
NULL` never appears. `20260630173510_HikePath` did exactly that, which is why
`dbo."Hikes"."GeoPath"` is nullable in every deployed database while the snapshot says
required — and why `has-pending-model-changes` stays green, since it compares the model to the
snapshot rather than to a database. Whenever nullability changes, pass **both** `nullable:` and
`oldNullable:`. See
[altercolumn-nullable-needs-oldnullable](../../../docs/notes/altercolumn-nullable-needs-oldnullable.md).

## Nothing in the test suite applies your migration

The suites run **SQLite in-memory** and build their schema from the model, not from the
migrations. So:

- a green `dotnet test` says nothing at all about whether the migration applies;
- `DbMigrationRunner` applies it on API startup, against real PostGIS, which is the first
  time it ever runs;
- to see it run, bring the stack up — see [verify-in-docker](../verify-in-docker/SKILL.md).

This is the single most common way a migration reaches a deploy unexercised.

## Geometry columns

SRID 4326, always — `geometry(Point, 4326)` / `geometry(LineString, 4326)`, with the typmod
and SRID configured in `StigViddDbContext`. Anything that *builds* a point in C# goes through
`Core/Spatial/GeoPointFactory.cs`, which is the only place the SRID and the
`(X = longitude, Y = latitude)` order live. Read
[srid-4326](../../../docs/notes/srid-4326.md) and
[docs/spatial-data.md](../../../docs/spatial-data.md) before adding a geometry column.

A migration that backfills geometry from existing columns is the `*PostGIS*` and facility/
obstacle-point shape: hand-written `ST_SetSRID(ST_MakePoint(lon, lat), 4326)` in `Up`. Note
the argument order there is also longitude first.

Retagging an existing column's SRID needs **no** data statement, and adding one is harmful
rather than cautious: `ALTER COLUMN ... TYPE geometry(..., 4326)` converts SRID-0 rows itself
and *refuses* a foreign SRID, which is the only check that can catch a projected geometry —
whereas an `ST_SetSRID` backfill would relabel SWEREF99 metres as degrees and report success.
Measured in [postgis-srid-coercion](../../../docs/notes/postgis-srid-coercion.md).
