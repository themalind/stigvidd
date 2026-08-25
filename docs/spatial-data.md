# Spatial Data — Trails, Hikes & Map Markers

How geographic routes and point locations are stored, queried, and shipped to the app.
Trails and hikes keep their path as a **PostGIS geometry** (`LineString`) in PostgreSQL via
NetTopologySuite, but talk to clients as a **JSON array of `{latitude, longitude}`**.
Facilities and trail obstacles keep a single **`Point`** and talk to clients as **lat/long
decimals**. This is a behavioral reference for those boundaries and the spatial queries
built on them.

## Key files

| Concern                                  | File                                                                                    |
| ---------------------------------------- | --------------------------------------------------------------------------------------- |
| Trail entity (`GeoPath` geometry column) | `backend/Infrastructure/Data/Entities/Trail.cs`                                         |
| Hike entity (`GeoPath` geometry column)  | `backend/Infrastructure/Data/Entities/Hike.cs`                                          |
| Facility entity (`Coordinates` point)    | `backend/Infrastructure/Data/Entities/Facility.cs`                                      |
| Obstacle entity (`IncidentLocation`)     | `backend/Infrastructure/Data/Entities/TrailObstacle.cs`                                 |
| Point ⇄ lat/long decimals                | `backend/Core/Spatial/GeoPointFactory.cs`                                                |
| Geometry column config (typmod + SRID)   | `backend/Infrastructure/Data/StigViddDbContext.cs`                                      |
| Geometry → wire JSON                     | `backend/Core/Spatial/GeoPathSerializer.cs`                                              |
| Trail read/write + spatial ranking       | `backend/Core/Services/TrailService.cs`, `backend/Core/Repositories/TrailRepository.cs` |
| Hike write + validation                  | `backend/Core/Services/HikeService.cs`                                                  |
| PostGIS enablement + backfill migrations | `backend/Infrastructure/Migrations/*PostGIS*.cs`                                        |
| NetTopologySuite provider config         | `backend/Infrastructure/Data/DesignTimeDbContextFactory.cs`                             |
| Wire JSON → GeoJSON positions (client)   | `app/src/utils/coordinate-parser.ts`                                                    |
| Marker fetch (client)                    | `app/src/api/map-markers.ts`                                                            |

## Storage model

The route is a PostGIS **`geometry(LineString)`** column named `GeoPath`, in **SRID
4326** (WGS84 lon/lat). EF Core maps it to a NetTopologySuite `LineString` via
`o.UseNetTopologySuite()` on the Npgsql provider.

```
Trail.GeoPath              : LineString?   // nullable — a trail may exist before its path is imported
Hike.GeoPath               : LineString    // required — a hike is its recorded track
Facility.Coordinates       : Point?        // nullable — area facilities have no point
TrailObstacle.IncidentLocation : Point?    // nullable — the reporter may not pin a point
```

Facilities and obstacles used to store two `decimal?` columns each. They are now a single
`geometry(Point, 4326)` column, so "facilities near me" and "obstacles close to this path"
are PostGIS operators rather than hand-rolled haversine over a full table read. Because a
point is one value, **lat and long travel as a pair**: the request validators reject a half
pair, and `FacilityService.UpdateFacilityAsync` rebuilds the point only when both ordinates
are supplied. Coordinate-less facilities are excluded from the marker endpoint by a single
`Coordinates != null` filter (`FacilityRepository.GetAllAsync`).

**Coordinate order gotcha:** GIS geometry is **(X, Y) = (longitude, latitude)**. So a
`Coordinate` is always constructed `new Coordinate(c.Longitude, c.Latitude)`, and
`StartPoint.Coordinate.X` is longitude, `.Y` is latitude. GeoJSON on the client is
also `[longitude, latitude]` — but the **wire format between them is
`{latitude, longitude}` objects**, so the mapping is explicit at both ends.

### SRID, and the SQLite/SpatiaLite gotcha

The `Point` columns are genuinely SRID 4326: `GeoPointFactory` is the only place that builds
one, and it stamps the SRID there. Two provider-specific bits in `StigViddDbContext` keep
that true on both sides:

- **Npgsql** gets `HasColumnType("geometry(Point, 4326)")` (guarded by `Database.IsNpgsql()`),
  so the column itself constrains type and SRID.
- **SQLite** — used by the integration suite via SpatiaLite — gets
  `HasAnnotation("Sqlite:Srid", 4326)`. EF's SQLite provider registers geometry columns with
  `SELECT AddGeometryColumn(...)` at **SRID 0 unless told otherwise**, and SpatiaLite
  *enforces* that SRID on insert. Without the annotation every 4326 point fails to insert in
  tests with an SRID mismatch. This is the non-obvious part: the test schema comes from
  `EnsureCreated()` on the model, so the model is the only place that can fix it.

`Trail.GeoPath`, `Hike.GeoPath` and `TrailImportProposal.FeatureGeometry` are configured the
same way — `geometry(LineString, 4326)` under Npgsql, `Sqlite:Srid = 4326` for the test schema
— since `PathGeometrySrid4326`. Before it they were mapped by convention to an unconstrained
`geometry` column while the *backfill* migrations had written 4326 into them, so a single
column held both SRIDs and `TrailRepository.GetPopularTrailOverviewsAsync` — which built a
comparison point at 4326 and called `ST_Distance` against the stored path — raised
`Operation on mixed SRID geometries` against every app-written row. There is now exactly one
way to build any of them, `GeoPointFactory`.

That query no longer compares geometries at all. It scales each axis by its own
metres-per-degree at the user (`LocalMetricProjection`) and does the arithmetic on
`ST_StartPoint`'s ordinates, so it is SRID-agnostic *and* translates on all three providers —
Npgsql, SpatiaLite and in-process NTS under EF InMemory. `ST_DistanceSphere` and a
`::geography` cast would each be Npgsql-only. Note it is deliberately two queries: the
proximity term is absent from the SQL entirely when no user location is supplied, because EF
parameterises a captured `bool` rather than folding it away.

Two PostGIS behaviours are worth knowing before touching these columns, both measured:

- **SRID 0 is "unknown", and therefore assignable.** Writing an SRID-0 geometry into a 4326
  column does not fail — PostGIS silently retags it. That is also why the typmod change in
  `PathGeometrySrid4326` needed no data statement: the `ALTER` converted the existing SRID-0
  rows on its own.
- **A foreign SRID is refused.** `ERROR: Geometry SRID (3006) does not match column SRID
  (4326)`, on write and on the `ALTER`. Do not "help" that along with an
  `UPDATE ... ST_SetSRID(..., 4326)`: it would relabel projected SWEREF99 metres as degrees
  without moving them, which is silent corruption where the error was a safety net.

SpatiaLite is stricter than PostGIS in one direction and laxer in another, which is why the
suites catch some of this and not the rest: it **rejects** a mismatched SRID on insert (so a
missed write site fails the integration tests loudly), but it **computes `ST_Distance` across
mismatched SRIDs without complaint** where PostGIS raises. The mixed-SRID query failure was
therefore only ever reproducible against real PostGIS.

### How PostGIS was introduced

Three migrations (see `*PostGIS*`): enable the extension, add the geometry columns,
and — in `PostGIS_Path` — **backfill** `GeoPath` from the legacy `Coordinates` JSON
text column with a SQL `ST_MakeLine(ST_MakePoint(lon, lat))` grouped per trail, set to
SRID 4326. New writes go straight to geometry; the old JSON column is no longer the
source of truth.

`FacilityAndObstaclePoints` did the same for the point columns: add the geometry column,
backfill with `ST_SetSRID(ST_MakePoint("Longitude", "Latitude"), 4326)`, then drop the
decimals. Rows that had only one ordinate stay null — a half pair was never a location.
Note this is a one-way loss: reverting the migration cannot bring a half pair back.

The same migration adds the GIST indexes the proximity queries need
(`IX_Facilities_Coordinates`, `IX_TrailObstacles_IncidentLocation`), declared in the model
inside the `Database.IsNpgsql()` guard — `gist` is not an index method SQLite understands,
and the test schema is built from the model by `EnsureCreated()`. `Trail`/`Hike` `GeoPath`
have no spatial index, deliberately: the one query that measures against them
(`GetPopularTrailOverviewsAsync`) has no spatial predicate to probe — it scores and orders
every verified trail — and a GiST index on the column cannot serve `ST_StartPoint` of it
anyway. An index there belongs with a decision to gate "popular" by radius, which would
change what the endpoint returns.

## The wire boundary

Clients never see geometry — they see a JSON string. Two directions:

**Read (geometry → JSON):** `GeoPathSerializer.ToCoordinateJson(geoPath)` serializes
`LineString.Coordinates` to `[{latitude: c.Y, longitude: c.X}, …]`; a null path → `"[]"`.
Note it runs in the **top-level projection** (e.g. `HikeService.GetHikesAsync`), which
EF Core evaluates **client-side** after materializing the geometry — it is not
translated to SQL.

**Write (JSON → geometry):** services deserialize the request's coordinate blob
(`Newtonsoft.Json`) into `WebDataContracts.Coordinate[]`, then build
`new LineString(points.Select(c => new Coordinate(c.Longitude, c.Latitude)))`.

### Write-time validation (why it's strict)

Neither the geometry column nor NetTopologySuite enforces geographic ranges, so the
services guard every incoming path (`HikeService`, `TrailService`):

- A malformed JSON blob → **400**, not an unhandled 500 (it's expected client input).
- Length must be **≥ 2** (a line needs two points) and **≤ `MaxCoordinates`**.
- Every point must be **finite** and within **WGS84 bounds** (lat ±90, lng ±180).
  An out-of-range point that persisted would corrupt the rendered route and any
  distance/bounds computed from it.

## Client parsing (`CoordinateParser`)

The single boundary where the wire format becomes the app's GeoJSON render model.
It parses the JSON string into `GeoJSON.Position[]` (`[lng, lat]`) and is
**defensive on purpose**: the payload is untrusted JSON, so a non-array shape or any
point with a missing / non-finite coordinate is **dropped** rather than producing
`NaN` positions that would later corrupt the route line and the camera bounds. Single
pass for large trails; failures log and return `[]`.

Downstream, these positions feed `lineStringFromPositions` (route lines),
`getBoundsFromTrail` (camera fit), and the follow-map puck — see
[`map.md`](./map.md).

## Spatial queries

Because the path is real geometry, PostGIS operators run in SQL:

- **Trail markers** (`GetAllTrailMarkersAsync`, `/trails/markers`) — projects each
  verified trail with a non-null path to its **start point**:
  `t.GeoPath.StartPoint.Coordinate.Y` (lat) / `.X` (lng). The app clusters these (see
  `map.md`). Only `IsVerified && GeoPath != null` trails are returned.
- **Popular / nearby ranking** (`GetPopularTrailOverviewsAsync`) — scores each trail
  by average review rating **boosted by proximity** when the user's location is known:
  `5.0 / (1.0 + StartPoint.Distance(userLocation) / 10.0)`. The user location is built
  as `Geometry.DefaultFactory.WithSRID(4326).CreatePoint(new Coordinate(lng, lat))`.
  Ordering/scoring is a **repository** concern; the response shape comes from the
  caller's `selector` so the repository never builds a response model.
- **Single trail coordinates** (`GetCoordinatesByTrailIdentifierAsync`) — selects just
  `GeoPath` and serializes it, for the follow map / detail preview.

### The Npgsql projection gotcha (resolved)

`GeoPathSerializer` and other C#-only helpers must sit in the **outer** projection so
EF Core evaluates them **client-side after materialization**. Pushing a
non-translatable expression into a part of the query the provider tries to translate
to SQL made Npgsql throw at runtime (surfaced as a 500). Keep geometry access
(`.StartPoint`, `.Distance`) — which _is_ translatable — separate from C# serialization
(`ToCoordinateJson`), which must run after the row is materialized.

## End-to-end shapes

```
Write:  client { latitude, longitude }[]  ──JSON──►  Coordinate(lon,lat)[]  ──►  LineString (SRID 4326)
Read:   LineString  ──GeoPathSerializer──►  { latitude, longitude }[]  ──JSON──►  CoordinateParser  ──►  [lng, lat] (GeoJSON)
Marker: LineString.StartPoint  ──►  { startLatitude, startLongitude }  ──►  cluster pin
```

## Edge cases — quick reference

| Scenario                                           | Behavior                                                                    |
| -------------------------------------------------- | --------------------------------------------------------------------------- |
| Trail without an imported path (`GeoPath == null`) | Excluded from markers/ranking; coordinates serialize to `[]`.               |
| Malformed coordinate blob on write                 | `400` (mapped from JSON parse failure), not a 500.                          |
| Fewer than 2 points                                | Rejected (`400`) — a line needs two points.                                 |
| Point outside WGS84 range / non-finite             | Rejected (`400`) at write time.                                             |
| Corrupt/partial JSON reaching the client           | `CoordinateParser` drops bad points, returns `[]` on failure — never `NaN`. |
| lon/lat vs lat/lon confusion                       | Constructed explicitly at each boundary; geometry is `(X=lng, Y=lat)`.      |
| Facility without coordinates (`Coordinates == null`) | Excluded from `/facilities` markers, where the response reports lat/long as `0` (legacy shape). Reached through a city area instead, where `CityAreaResponseFactory` reports both as `null`. |
| Request carrying only one of lat/long              | `400` — a point cannot be half-set.                                         |
| Geometry written at SRID 0 (a raw NTS factory)      | Silently retagged 4326 by the Postgres typmod; **rejected** by SpatiaLite's trigger, so the integration tests are what catch it. |
| Geometry written at a foreign SRID (e.g. 3006)      | Rejected by both — `Geometry SRID (3006) does not match column SRID (4326)`. |
| C# serializer pushed into SQL projection           | Npgsql 500 — keep it in the outer client-side projection.                   |

## Related docs

- [`map.md`](./map.md) — how these coordinates render (clustering, route lines, camera).
- [`record-hike.md`](./record-hike.md) — how a hike's coordinate track is recorded before it's stored as a `GeoPath`.
