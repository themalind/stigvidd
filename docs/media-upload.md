# Media & Image Upload — Full Flow & Behavior

How an image goes from the user's camera roll to a stored, servable URL: client-side
shrink, server-side processing (ImageMagick), and durable storage over WebDAV. This
is a behavioral reference — it explains the processing order and the retry/idempotency
decisions that are easy to break.

## Key files

| Concern                                 | File                                                    |
| --------------------------------------- | ------------------------------------------------------- |
| Client pre-upload resize/compress       | `app/src/utils/resizeImage.ts`                          |
| Orchestrates process → upload           | `backend/Core/Services/MediaUploadService.cs`           |
| ImageMagick processing                  | `backend/Core/Services/ImageProcessingService.cs`       |
| Request DTO → processing options        | `backend/Core/Services/ImageProcessingOptionsMapper.cs` |
| WebDAV storage (upload/delete/download) | `backend/Core/Services/WebDavService.cs`                |
| Media records + presentable URLs        | `backend/Core/Services/MediaService.cs`                 |
| Upload endpoints (trail/facility/symbol) | `backend/StigviddAPI/Controllers/Admin/AdminTrailsController.cs`, `AdminFacilitiesController.cs` |
| Upload endpoint (review photos)         | `backend/StigviddAPI/Controllers/ReviewsController.cs` (`POST api/v1/reviews`) |
| Media library + image metadata          | `backend/StigviddAPI/Controllers/Admin/AdminMediaController.cs` |
| Admin web upload panel                  | `web/src/components/media/media-upload.tsx`, `web/src/pages/media/media-page.tsx` |
| Admin web upload rules (tested)         | `web/src/lib/media-upload.ts`                           |
| Admin web staged files across a refresh | `web/src/lib/staged-media.ts`                           |
| Batch reprocess job + dispatcher        | `backend/Core/Services/MediaReprocessService.cs`, `backend/StigviddAPI/BackgroundServices/MediaReprocessDispatcher.cs` |
| Admin web batch dialog + jobs list      | `web/src/components/media/media-reprocess-dialog.tsx`, `web/src/components/media/media-reprocess-jobs.tsx` |

## The pipeline at a glance

```
 client                    backend MediaUploadService
 ──────                    ─────────────────────────────
 resizeImage (≤1080px,     Process (ImageMagick)  ──►  WebDavService.UploadFileAsync
 JPEG q0.6)  ── upload ──►    orient/crop/resize        (buffer once, retry ×3)
                              strip/encode          ──►  returns remotePath
                            MediaRepository row      ──►  presentable URL to clients
```

Two-stage size reduction on purpose: the **client** shrinks first to cut upload
bandwidth; the **server** re-processes to a canonical, metadata-stripped form it
controls (never trusting the client's output).

## Where uploads come from

| Caller | Route | WebDAV subdirectory |
| ------ | ----- | ------------------- |
| Mobile app, review photos | `POST api/v1/reviews` (multipart) | `reviews` |
| Admin web, trail gallery | `POST api/v1/admin/trails/{identifier}/images` | `trails` |
| Admin web, trail symbol | `POST api/v1/admin/trails/{identifier}/symbol` | `symbols` |
| Admin web, facility gallery | `POST api/v1/admin/facilities/{identifier}/images` | `facilities` |

All four go through `MediaUploadService.ProcessAndUploadAsync`. The admin routes are
behind the `AdminOnly` policy (see [auth](auth.md)); gallery images are deleted through
`DELETE api/v1/admin/{trails|facilities}/images/{imageIdentifier}`, and the symbol has no
delete endpoint.

## Client: `resizeImage`

Before upload, `resizeImage(uri)` runs an `expo-image-manipulator` pipeline: resize to
**max width 1080px** (height scales to preserve aspect ratio) and re-encode to **JPEG
at 0.6 compression**, writing a new file and returning its uri. This is purely a
bandwidth optimization — the server does the authoritative processing.

## Admin web: the upload panel

Review photos from the app are processed with fixed server-side options
(`ImageProcessingOptions.StripMetadataOnly` — the app has already resized them); the admin
dashboard's *Media* page lets the operator choose the options per upload. The panel's decisions live in `web/src/lib/media-upload.ts` so
they are tested without a file picker:

- **`buildImageOptions`** turns the resolution / quality / format / crop choices into the
  request's `ImageProcessingOptions`. These are **destructive** — the server resizes,
  re-encodes and crops before storing, and the original is not kept.
- **`acceptImages`** drops anything that is not `image/*`; a single-file target (the
  trail symbol) keeps only the newest file. Cropping is offered only for a single staged
  file.
- **`attachedTo`** matches the library's images to the chosen target on owner identifier
  **and** owner type — a trail symbol carries its trail's identifier, so matching on the
  id alone would list the symbol among the gallery images with a delete button that has
  no endpoint.

**Staged files survive a page refresh** (`web/src/lib/staged-media.ts`): the picked bytes
are copied into IndexedDB (`stigvidd-media`) and the chosen target into localStorage. The
bytes are stored as an owned `Blob`, not the picked `File` — a `File` is only a reference,
and after a refresh the upload would stall rather than fail. All of it is best-effort: a
failing store resolves to "nothing staged" and never blocks an upload.

## Server: `ImageProcessingService.Process`

Uses **ImageMagick** (`Magick.NET`). The **order of operations is deliberate**:

1. **`AutoOrient()` first.** Bake in the EXIF orientation _before_ metadata is
   stripped — otherwise phone photos come out rotated (the orientation flag would be
   dropped by `Strip()` while the pixels stay un-rotated).
2. **Crop** (if `Crop` given and > 0), then `ResetPage()` so the cropped region
   becomes the new canvas origin.
3. **Resize** to `MaxWidth`/`MaxHeight` — **downscale only, never enlarge** a smaller
   source (`Greater = true` on the geometry, guarded by a `Width/Height >` check).
4. **`Strip()`** — drop EXIF/GPS/color-profile bloat (privacy + size). This is why
   `AutoOrient` must run first.
5. **Quality** applied if in `[1,100]`.
6. **Format** — Jpeg / WebP / Png / Original, mapped from the request.

Returns a `ProcessedImage` with the encoded stream, resolved extension, content type,
final width/height, and byte size. `jpg` is normalized to `jpeg`.

### `ImageProcessingOptionsMapper`

Maps the request DTO to options defensively: a crop is only built when **both**
`CropWidth` and `CropHeight` are > 0; unknown/empty format strings fall back to
`Original`; a null request yields default options (no-op processing).

## Server: `WebDavService.UploadFileAsync`

Stores the processed image on a WebDAV backend (behind nginx). The subtleties:

- **GUID filenames.** `{Guid}.{ext}` under an optional subdirectory (e.g.
  `reviews/…`). No user-controlled names, no collisions.
- **Buffer once, then retry.** The incoming stream is **forward-only** — it would be
  drained after the first attempt. So the content is copied into a `MemoryStream`
  once, and each retry rewinds (`Position = 0`) and re-sends from the start.
- **Retry only transient transport failures.** Up to `MaxUploadAttempts` (3) with a
  linear backoff (`RetryBaseDelayMs * attempt`). `IsTransient` matches connection-level
  faults only (`HttpRequestException`/`IOException`/`SocketException`, incl. inner).
- **A real HTTP status is not retried.** A `403`/`409`/`500` from the server is a
  definitive answer, not a transport hiccup — return the failure immediately.
- After all attempts exhaust on transient errors, it throws (the caller maps to 500).

Companion methods: `DeleteFileAsync` (cleanup on record delete), `DownloadFileAsync`,
`EnsureDirectoryExistsAsync` (treats `405` as "already exists"), and `UploadToPathAsync`
(exact path; buffers so nginx `create_full_put_path` gets a length-known, rewindable
body).

## Server: `MediaUploadService` — the orchestrator

`ProcessAndUploadAsync(stream, subDirectory, options)`:

1. `Process` the stream (ImageMagick).
2. `UploadFileAsync` the processed stream.
3. On success return `UploadedMedia(remotePath, width, height, sizeBytes)`.

Everything is wrapped so a processing or upload failure becomes a `Result.Fail(500)`
rather than an exception escaping. The `ProcessedImage` stream is `using`-disposed.

## Server: `MediaService` — records & presentable URLs

`MediaService` reads media rows and builds **`MediaItemResponse`** objects, prefixing
the stored relative path with the configured **`PresentableBaseUrl`** so clients get a
fully-qualified, servable URL (the DB stores the relative WebDAV path;
`PresentableBaseUrl` is the public host that serves it). It also updates alt-text /
caption metadata. `PresentableBaseUrl` is required config — the service throws at
construction if it's missing.

## Batch reprocessing already-stored images

The admin Media page's Browse tab can select existing Trail/Facility images and resize/
re-encode them in the background, using the same `ImageProcessingService`/`WebDavService`
pipeline above rather than a second one. Trail symbols are excluded — they carry no stored
width/height/size to update.

```
 web (Browse)              MediaReprocessService          MediaReprocessDispatcher
 ──────────────            ────────────────────           ─────────────────────────
 select images  ── POST ──►  validate + create job   ──►   claim item (Pending→Processing)
 + options         /reprocess  (MediaReprocessJobs/Items)    download → Process → upload
                                                              MarkSucceeded/Failed, delete old file
```

Same claim-based dispatch as `MailOutboxDispatcher` (`Pending → Processing`, `Conflict`
ignored, a startup sweep re-signals every `Pending` item), but with no retry/backoff ladder:
`WebDavService` already retries its own transient failures, so an item gets one attempt here.
A job has no stored status/counters — `MediaReprocessJobSummaryResponse.Create` computes
`Pending`/`Processing`/`Completed` from the live item counts on every read.

`MediaReprocessDispatcher` and `MediaReprocessRetentionService` are removed from the
integration test factory (`WebApplicationFactory.cs`), the same way the mail outbox pair is,
so those tests only prove the HTTP surface and journal, not that a job completes.

### Finding the images that need it

`GET /api/v1/admin/media` is paged and filterable (`MediaLibraryQuery`), and every filter is
one expression — `MediaRepository.Matches<T>`, over the `IMediaImage` the two image entities
share. Filters: owner type and owner identifier, format, width/height/size bounds, an upload
date range, and the **target pair** `TargetMaxWidth`/`TargetFormat`, which keeps only the
images a reprocess to that target would change.

Five rules that no diff will remind you of:

- **`CreatedTo` is exclusive.** The web sends the day *after* the date the operator picked,
  or every image uploaded on that day drops out of a filter that names it.
- **A trail symbol is dropped from any query carrying a metadata filter** (format, dimension,
  size, target). It stores `0/0/0` rather than measurements, so `0 ≤ maxWidth` would match
  every "smaller than" bound. `ReprocessableCount` in the response is the count without them
  — `TotalCount` would overstate what a batch can touch.
- **Width or height of 0 means unknown, not small.** `TrailService` stores images from a URL
  list with no measurements at all, so the target filter *keeps* those rows rather than
  ruling them already-compact.
- **`OwnerType` is accepted in any casing and consumed canonically.** The validator matches
  `OrdinalIgnoreCase`, so `?ownerType=trail` is valid; `MediaRepository.Sources` branches on
  `MediaOwnerTypes.Canonical(...)` rather than on the raw string. When it compared the raw
  string, a lower-case owner type was a 200 with an empty library — the one wrong answer an
  operator cannot see is wrong. An owner type that canonicalises to nothing yields **no
  sources at all**, never every source.
- **`Page` is capped, and the offset is computed in `long`.** Unbounded,
  `?page=20000000&pageSize=200` overflowed `(page - 1) * pageSize` to a negative, `Skip`
  clamped it to zero, and the endpoint served page 1 under the page number asked for with
  `hasMore: true` — which the web’s next button follows forever.

Sorting is `sort=newest|oldest|largest|widest` (`MediaSorts`), applied in memory after the
merge. The browse toolbar has a control for it; changing it rewinds to page 1 and keeps the
selection, because the same images are still matched.

### Two ways to name a batch

`POST /reprocess` takes **either** `mediaIdentifiers` (capped at
`MediaReprocessLimits.MaxExplicitBatchSize`, 2000) **or** a `filter`, which the server expands
itself (capped at `MaxFilterBatchSize`, 5000). Exactly one; neither and both are a 400. That
is what lets the admin start a job over more images than fit in a request body — the web's
"Select all N matching this filter" sends the filter, never a list.

A filter matching more than the cap is **refused, not truncated**: a silently shortened batch
leaves the operator believing the library is done, with no record of what was left out.

`MediaIdentifiers` must not be `required` — System.Text.Json enforces that on
deserialization, so a filter-only body would be rejected by the JSON binder before any
validator ran.

The **same** `MediaFilterValidator` runs over the filter on both routes. It was two rulesets,
and the query one allow-listed `OwnerType`/`Format`/`TargetFormat` while the body one did not
— so `format=wepb` was a clear 400 on `GET` and `"No images match that filter."` on `POST`.
`MediaFormats` names the three lists that differ on purpose: `Filterable` (what the library
may hold, including `gif`), `Output` (what `Options.Format` accepts, including `original`),
and `ReprocessTarget` (`Output` without `original` — a `TargetFormat` naming something no
reprocess can produce would count images for a batch that cannot run).

**Quality is not stored anywhere**, so "already optimized" can only ever mean "already within
the target size and already that format". Re-running the 800px/q50/WebP preset over an
already-compact image still re-encodes it. The dialog says so rather than implying the filter
is exact.

## Edge cases — quick reference

| Scenario                               | Behavior                                                      |
| -------------------------------------- | ------------------------------------------------------------- |
| Rotated phone photo (EXIF orientation) | `AutoOrient` before `Strip` → correct orientation.            |
| Source smaller than max dimensions     | Not enlarged; kept as-is.                                     |
| Crop with zero/absent dimensions       | No crop applied.                                              |
| Unknown/empty output format            | Falls back to `Original`.                                     |
| WebDAV connection reset / timeout      | Retried up to 3× with backoff (buffer rewound each time).     |
| WebDAV returns 403/409/500             | Not retried; failure returned immediately.                    |
| Upload directory missing               | `EnsureDirectoryExistsAsync` (405 = already exists).          |
| Processing or upload throws            | Mapped to `Result.Fail(500)`, logged; no unhandled exception. |
| Missing `PresentableBaseUrl` config    | Service construction throws (fail fast at startup).           |

## Tunable constants

| Constant             | Value   | Where              | Meaning                                 |
| -------------------- | ------- | ------------------ | --------------------------------------- |
| `MAX_IMAGE_WIDTH`    | 1080 px | `resizeImage.ts`   | Client-side downscale width.            |
| `JPEG_COMPRESSION`   | 0.6     | `resizeImage.ts`   | Client JPEG quality (0–1).              |
| `MaxUploadAttempts`  | 3       | `WebDavService.cs` | Transient-failure retry count.          |
| `RetryBaseDelayMs`   | 300     | `WebDavService.cs` | Linear backoff base (× attempt).        |
| `PresentableBaseUrl` | config  | appsettings        | Public host prefixed onto stored paths. |
