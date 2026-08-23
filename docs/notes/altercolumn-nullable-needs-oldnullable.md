# `AlterColumn(nullable: false)` without `oldNullable: true` emits nothing at all

`MigrationBuilder.AlterColumn` describes the column **before and after**. `oldNullable`
defaults to `false`, so writing only `nullable: false` tells EF "it was non-nullable and it
still is" — no change, nothing emitted. The `SET NOT NULL` you thought you scaffolded is not
in the SQL, and the column stays nullable in every database the migration is applied to
while the model snapshot records it as required.

Nothing catches this afterwards. `dotnet ef migrations has-pending-model-changes` compares the
model against the **snapshot**, not against a database, so it stays green: both say required.
The divergence is between the snapshot and the actual schema, and only a live database can
show it.

## Measured, on `postgis/postgis:17-3.5`

[`20260630173510_HikePath.cs`](../../backend/Infrastructure/Migrations/20260630173510_HikePath.cs)
adds the column nullable, backfills it from the old `Coordinates` JSON, then does this:

```csharp
migrationBuilder.AddColumn<LineString>(
    name: "GeoPath", schema: "dbo", table: "Hikes", type: "geometry", nullable: true);
// ... backfill Sql(...) ...
migrationBuilder.AlterColumn<LineString>(
    name: "GeoPath", schema: "dbo", table: "Hikes", type: "geometry", nullable: false);
//                                                                   ^ no oldNullable: true
```

Script it and the third statement is simply absent:

```sh
cd backend && dotnet ef migrations script RenameFirebaseUidToSubjectId HikePath \
  --project Infrastructure -o /tmp/hikepath.sql
grep -i 'Hikes"' /tmp/hikepath.sql
#   ALTER TABLE dbo."Hikes" ADD "GeoPath" geometry;
#   ALTER TABLE dbo."Hikes" DROP COLUMN "Coordinates";
```

Two statements, not three. Applying the full chain to an empty PostGIS and asking the
catalogue confirms the column is still nullable:

```sql
SELECT table_name, column_name, is_nullable FROM information_schema.columns
WHERE table_schema = 'dbo' AND column_name IN ('GeoPath', 'FeatureGeometry');
--  Hikes | GeoPath | YES        <-- while the snapshot says .IsRequired()
```

## Why it bites rather than merely being untidy

`Hike.GeoPath` is `required LineString` — **not** nullable — in
[`Hike.cs`](../../backend/Infrastructure/Data/Entities/Hike.cs). EF will happily materialise a
NULL column into it, `required` notwithstanding: `required` is a C# initialisation rule, not a
read-path check. So a NULL row hands the app a `Hike` whose non-nullable `GeoPath` is null, and
the first `hike.GeoPath.NumPoints` is a `NullReferenceException` in code the compiler said was
safe. `HikeService` always writes a path, so the exposure is old rows the `HikePath` backfill
could not populate — a hike whose `Coordinates` JSON did not parse.

`nullable`-as-error under [Directory.Build.props](../../backend/Directory.Build.props) does not
help here, because nothing in the C# is wrong; the schema is.

## What to do about it

- **Writing a migration:** whenever `nullable` changes, pass **both** — `nullable: false` and
  `oldNullable: true`. Then script the migration and read the SQL before trusting it.
  `dotnet ef migrations script <from> <to> --project Infrastructure -o <file>` needs no
  database and is the only thing that shows what will actually run.
- **Auditing an existing column:** ask `information_schema.columns` on a real database. The
  snapshot cannot tell you, and neither can `has-pending-model-changes`.
- **Fixing this specific one:** a new migration with the `SET NOT NULL`, preceded by a
  decision about the NULL rows it will refuse (delete them, or backfill an empty
  `LINESTRING`, which `GeoPointFactory.FromLonLatPath` builds and which round-trips fine —
  see [[postgis-srid-coercion]]). Not a change to `HikePath`, which is long applied.

Note that `PathGeometrySrid4326` carries the same `nullable: false` shape for `Hikes.GeoPath`
and is *correct* to: its intent is only the typmod, the snapshot already said required, and
scripting it confirms it emits three bare `ALTER COLUMN ... TYPE` statements and no
nullability change.

Related: [[postgis-srid-coercion]], [[srid-4326]], [[nullable-warnings-are-errors]].
