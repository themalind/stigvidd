# A media file is shared by many image rows, so deleting "the old file" of one row breaks the others

**Symptom.** A batch media reprocess over the "needs work" filter in production (2026-09-28)
reported about 100 succeeded and 700 failed. Every failure was
`DownloadFileAsync: <path> -> 404` in `stigvidd_api_logs`, and the same few paths repeated:
`mock/gesebol/20250824100243.jpg` 111 times, `mock/vindskydd_mock.jpg` 110,
`mock/storsjon/20241102113934.jpg` 110, and real photos such as
`trails/kransmossen_20260523_9.jpg` up to 9 times. Afterwards those paths returned 404 on
`https://media.stigvidd.se/` as well: the live images were broken, not just the batch.

**Why it looks like something else.** A 404 on download reads as "the file was never
there". It is easy to decide the `mock/*` placeholders are not on WebDAV at all, since
[is-mock-image.ts](../../app/src/utils/is-mock-image.ts) says they "live on stigvidd.se", and
exclude them. That is wrong. The public URL is `PRESENTABLE_BASE_URL + ImageUrl`
(`https://media.stigvidd.se/`), which is the same nginx `media` WebDAV server the API writes
to (`WebDav__BaseUrl: http://media/`). The files were there until the batch deleted them. The
counts are the tell: each is one row that succeeded plus N−1 that failed, and ~100 successes
matched the number of distinct files.

**Cause.** `ImageUrl` has no unique index; `TrailImageConfiguration` and
`FacilityImageConfiguration` index only `Identifier`. One path is therefore shared by:

- the placeholders, about 110 trail rows each;
- real photos, a few rows each;
- possibly `HikeImages`, `ReviewImages`, `CityAreas.ImageUrl` and `Trails.TrailSymbolImage`.

Some rows also store the path with a leading `/` (`/trails/hedared_20260524_1.jpg`) and
others without it, so one file has two spellings.

The old `MarkSucceededAsync` repointed only the processed row. The dispatcher then called
`DeleteFileAsync(source.ImageUrl)`, which removed the file every sibling still pointed at.

**Rule.** Code that deletes a media file must first check that no other row, in any of those
tables and under either spelling, still references that path. The reprocess now repoints
every row on the old path and deletes only when `MediaReprocessSuccess.OldFileStillReferenced`
is false. See [MediaReprocessRepository.cs](../../backend/Core/Repositories/MediaReprocessRepository.cs)
and [MediaReprocessItemProcessor.cs](../../backend/Core/Services/MediaReprocessItemProcessor.cs).

**The item status has to follow the rows.** A row is repointed whatever its item says, so
`MarkSucceededAsync` also settles the items of those rows: every unsettled one in the same job
(Pending, Failed, Cancelled) and Pending ones in other jobs. Without that, "Retry failed" or a
second batch would re-encode the output (a second lossy pass) and then delete it as "the old
file". If no row matched at all (the image was deleted mid-batch), it returns NotFound, and the
processor deletes its own fresh upload and marks the item Failed instead of leaving it Processing.

**The other deleters, audited 2026-09-28.** Every other `DeleteFileAsync` caller deletes either
a path it just uploaded (rollback in Trail/Facility/Review/HikeService) or a hike/review image,
and those only ever get freshly minted paths. `DeleteTrailImageAsync` and
`DeleteFacilityImageAsync` remove the row and never the file (they orphan it, which is harmless).
So none can break a shared file today, but nothing enforces it: anything that starts copying an
existing `ImageUrl` into another row must add a reference check first.

**It is safe only with one worker.** `ClaimAsync` reads then writes without a concurrency token,
and the dispatcher is a single reader on one API instance. A second instance, or parallel
workers, could claim one item twice.

**Recovery is manual.** The files the 2026-09-28 batch deleted are gone, and an item records
neither its source nor its result path, so "Retry failed" only 404s again until the files are
restored to their old paths.

**A placeholder must keep `mock` in its path.** The app shows its "Example image" badge only
because the URL contains `mock` ([is-mock-image.ts](../../app/src/utils/is-mock-image.ts)).
A reprocessed file that lands in `trails/<guid>.webp` loses the badge, and after the shared-file
fix that would happen to all ~110 rows on a placeholder at once. So the reprocess uploads the
result into the source's own folder (`MediaReprocessItemProcessor.TargetDirectory`).

The logs came from OpenObserve; see [[openobserve-mcp-org-is-not-default]] for the org id it needs.
