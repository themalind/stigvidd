# Umeå kommun's trail export is not shaped like Borås's, and one MultiLineString used to fail the whole import

The trail import (`Core/TrailImport`, admin page `trail-import-page.tsx`) was written against the
Borås Stad GeoJSON. Umeå kommun's `vandringsleder.geojson` (99 features, measured 2026-10-04)
differs in several ways that matter:

| | Borås | Umeå |
| --- | --- | --- |
| geometry | LineString, often with no `type` | 90 LineString + **9 MultiLineString**, `type` written |
| id | `id` (number) | **none**, so ExternalId is `""` |
| length | `sparlangd`, free text in six shapes | `langd`, **integer metres**; `0` means never measured |
| other fields | `klassning`, `tillganglighet`, `tillg_text`, `sparmarkering` | `namn`, `delstracka`, `klass`, `kommun`, `datum`, `geo_point_2d` |

## Why the MultiLineString was a whole-session failure, not a skipped feature

[`SourceFeatureReader`](../../backend/Core/TrailImport/Source/SourceFeatureReader.cs) read every
element of `coordinates` as a point. In a MultiLineString that element is itself an array of
points, so `point[0].GetDouble()` threw `InvalidOperationException`. The reader's
"skip a broken feature" rule only covered *missing* geometry. The throw escaped to the
`catch` in `TrailImportAnalysisService`, and the session went to **Failed** with a JSON
error message that does not mention MultiLineString.

## Why LineMerger is not the fix

The parts "meet" within 0–18 m but their endpoints are **never bit-identical**, and NTS
`LineMerger` only joins exactly equal nodes. The reader now chains parts whose ends are
within 25 m, and turns each part that cannot be chained into its own feature (id suffixed
`#2`, `#3` when there is an id). The parts that do not meet are 400+ m apart (Strömbäck-Kont
"Kont N-Verksund" is a branched network), so a larger tolerance would draw lines that are
no trail.

Two consequences a reviewer sees:

- A leftover shorter than 25 m is dropped. Holmsundsleden carries a 1.4 m part sitting on a
  mid-line junction.
- A spur that was split off still carries the parent's `langd`. It shows "length disagrees":
  for example, a Tavelsjöleden spur of 0.14 km stated as 9.28 km. That is the parent's
  length, not a data error.

The result is 99 features in, 101 proposals out, all with unique fingerprints.

## Upload with source `umea-kommun`

The Source field defaults to `boras-stad` (`TrailImportService.DefaultSource`). Links are
unique per `(Source, GeometryFingerprint)`, so leaving it empty files Umeå's links and
exclusions under Borås.

Related: [[srid-4326]].
