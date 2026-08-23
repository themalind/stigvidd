# PostGIS treats SRID 0 as assignable, so the typmod normalises instead of rejecting

Measured against **PostGIS 3.5 / PostgreSQL 17.5** (the `postgis/postgis:17-3.5` image
`docker-compose.yml` pins) while pinning `Trail.GeoPath`, `Hike.GeoPath` and
`TrailImportProposal.FeatureGeometry` to `geometry(LineString, 4326)` in
`PathGeometrySrid4326`. Every line below was run, not reasoned about.

## SRID 0 is "unknown", and unknown is assignable

Both of these **silently succeed**, retagging the geometry to the column's SRID:

```sql
-- on write
UPDATE dbo."Trails" SET "GeoPath" = ST_MakeLine(...);       -- SRID 0 in, 4326 stored
-- on the typmod change, over existing SRID-0 rows
ALTER TABLE dbo."Trails" ALTER COLUMN "GeoPath" TYPE geometry(LineString, 4326);
```

So `ALTER COLUMN ... TYPE geometry(..., 4326)` **needs no `USING` and no data statement** to
convert a column full of SRID-0 rows. EF's bare scaffold is already correct and complete.

A **foreign** SRID is refused instead, on write *and* on the `ALTER`:

```
ERROR:  Geometry SRID (3006) does not match column SRID (4326)
```

## Which is why a retag UPDATE is the wrong fix, not a cautious one

The obvious-looking belt-and-braces statement is actively harmful:

```sql
-- DO NOT. This is the one thing that can turn an error into silent corruption.
UPDATE dbo."Trails" SET "GeoPath" = ST_SetSRID("GeoPath", 4326)
WHERE "GeoPath" IS NOT NULL AND ST_SRID("GeoPath") <> 4326;
```

It is redundant for the SRID-0 rows (the `ALTER` handles them) and it *defeats* the check for
the rows that matter: a SWEREF99 TM (3006) row holds projected **metres**, and `ST_SetSRID`
relabels it as degrees without moving it — a Borås trail lands in the Gulf of Guinea and the
migration reports success. The error was the safety net. `ST_SetSRID` retags; only
`ST_Transform` moves.

## The suite cannot see a mixed-SRID query, only a mixed-SRID write

SpatiaLite and PostGIS disagree in *opposite* directions, so each hides half of it:

| | SRID-0 value into a 4326 column | `ST_Distance` across mismatched SRIDs |
| --- | --- | --- |
| **PostGIS** | silently retagged to 4326 | **raises** `Operation on mixed SRID geometries` |
| **SpatiaLite** | **rejected** by the `ggi_*` trigger | computes it happily, no error, no NULL |

Consequences worth remembering:

- A missed write site **does** fail the integration tests — loudly, on insert. That is the
  guard that works.
- A mixed-SRID **query** is invisible to every suite. `TrailRepository`'s proximity ranking
  raised a PostGIS 500 in production for two months while
  `GetPopularTrails_WithUserLocation_ShouldReturnTrails` stayed green, because SpatiaLite just
  answered. Reproducing it needs real PostGIS, and no test in this repo applies a migration.
- An empty `LineString` at 4326 inserts and round-trips fine on both, `NumPoints = 0` — the
  SRID lives in the blob header independently of the point count. But `ST_IsEmpty` pushed into
  SQL does **not** match it on SpatiaLite, so assert emptiness client-side after materialising.

## Verifying a geometry migration without the compose stack

`.env` is gitignored and hand-carried, so `docker compose` refuses on a fresh box
(`POSTGRES_PASSWORD must be set`). A throwaway container is enough, and lets you build the
*mixed* population production actually has rather than testing against an empty dev database:

```sh
podman run -d --name srid-check -e POSTGRES_PASSWORD=x -e POSTGRES_USER=stigvidd \
  -e POSTGRES_DB=stigvidd -p 55432:5432 postgis/postgis:17-3.5
cd backend && dotnet ef database update <migration-before> --project Infrastructure \
  --connection "Host=localhost;Port=55432;Database=stigvidd;Username=stigvidd;Password=x"
# seed a mix, then apply the new migration and re-audit
```

`--connection` bypasses Infrastructure's user secrets. The audit that answers "is this column
clean" is `ST_SRID`, `ST_GeometryType`, `ST_Zmflag` and `min(ST_NPoints(...))` grouped per
column, plus `SELECT type, srid FROM geometry_columns WHERE f_table_schema = 'dbo'` — the
catalogue is the only thing that shows the typmod actually landed.

Related: [[srid-4326]], [[spatialite-per-os]], [[dotnet-test-connection-string]].
