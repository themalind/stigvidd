# Spatial Data — Trails, Hikes & Map Markers

How geographic routes are stored, queried, and shipped to the app. Trails and hikes
keep their path as a **PostGIS geometry** (`LineString`) in PostgreSQL via
NetTopologySuite, but talk to clients as a **JSON array of `{latitude, longitude}`**.
This is a behavioral reference for that boundary and the spatial queries built on it.

## Key files

| Concern                                  | File                                                                                    |
| ---------------------------------------- | --------------------------------------------------------------------------------------- |
| Trail entity (`GeoPath` geometry column) | `backend/Infrastructure/Data/Entities/Trail.cs`                                         |
| Hike entity (`GeoPath` geometry column)  | `backend/Infrastructure/Data/Entities/Hike.cs`                                          |
| Geometry → wire JSON                     | `backend/Core/Common/GeoPathSerializer.cs`                                              |
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
Trail.GeoPath : LineString?   // nullable — a trail may exist before its path is imported
Hike.GeoPath  : LineString    // required — a hike is its recorded track
```

**Coordinate order gotcha:** GIS geometry is **(X, Y) = (longitude, latitude)**. So a
`Coordinate` is always constructed `new Coordinate(c.Longitude, c.Latitude)`, and
`StartPoint.Coordinate.X` is longitude, `.Y` is latitude. GeoJSON on the client is
also `[longitude, latitude]` — but the **wire format between them is
`{latitude, longitude}` objects**, so the mapping is explicit at both ends.

### How PostGIS was introduced

Three migrations (see `*PostGIS*`): enable the extension, add the geometry columns,
and — in `PostGIS_Path` — **backfill** `GeoPath` from the legacy `Coordinates` JSON
text column with a SQL `ST_MakeLine(ST_MakePoint(lon, lat))` grouped per trail, set to
SRID 4326. New writes go straight to geometry; the old JSON column is no longer the
source of truth.

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
| C# serializer pushed into SQL projection           | Npgsql 500 — keep it in the outer client-side projection.                   |

## Related docs

- [`map.md`](./map.md) — how these coordinates render (clustering, route lines, camera).
- [`record-hike.md`](./record-hike.md) — how a hike's coordinate track is recorded before it's stored as a `GeoPath`.
