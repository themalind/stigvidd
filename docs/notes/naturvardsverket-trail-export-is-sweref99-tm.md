# Naturvårdsverket's trail exports are SWEREF99 TM (EPSG:3006), not WGS84

Measured 2026-10-25 on `naturvardsverket-Leder.geojson` (12 050 features) and
`naturvardsverket-Statliga_Leder.geojson` (2 004 features): both declare
`"crs": {"properties": {"name": "urn:ogc:def:crs:EPSG::3006"}}` and their coordinates are
SWEREF99 TM easting/northing (e.g. `[392726.4338, 7001831.936]`), not WGS84 lon/lat.
`RUFS2050_Regional_vandringsled.geojson` is CRS84 (ordinary lon/lat) and needed no fix.

## Why this looked like "low quality data", not a CRS bug

[`SourceFeatureReader`](../../backend/Core/TrailImport/Source/SourceFeatureReader.cs) read
every coordinate pair as `(lon, lat)` with no CRS awareness — easting/northing went straight
into `GeoPointFactory.FromLonLatPath` as if they already were degrees. Nothing throws: NTS
does not range-check a `Point`, so the session analyses end to end and produces proposals,
just ones whose "feature" sits thousands of kilometres from any trail — every coverage figure
and Hausdorff distance is garbage, and everything reads Unmatched. The symptom (bad matches)
pointed at the matcher, not at the reader.

## The fix

`SourceFeatureReader.Read` now inspects the FeatureCollection's `crs.properties.name` once
and reprojects every coordinate through
[`Sweref99TmProjection.ToWgs84`](../../backend/Core/Spatial/Sweref99TmProjection.cs) when it
names EPSG:3006, before `Chain`'s Haversine joining ever sees the points. SWEREF99's datum is
close enough to WGS84 that no datum shift was needed, only the map projection (Krüger's
n-series, validated against known points before porting to C#, not derived from memory alone).
No `crs` member, or one naming CRS84/4326, is left as-is — that is every other known source.

## Field names also differ per source, not just geometry

Naturvårdsverket's two exports use `LEDNAMN`/`STATLIGLEDNAMN` for name (not `namn`),
`LED_ID`/`OBJECTID` for id (not `id`), and `LEDLANGD` for length in bare metres (like Umeå's
`langd`). `RUFS2050` has no name field at all (`FID`, `KKOD`, `KATEGORI`,
`Shape__Length` only) — that is the source, not a reader gap. `ReadFirstString` in
`SourceFeatureReader` and the `langd`/`LEDLANGD` loop in `TrailImportResponseFactory.
ReadSourceLength` try each known spelling in turn.

Related: [[umea-trail-export-differs-from-boras]], [[srid-4326]].
