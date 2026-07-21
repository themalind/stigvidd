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
| HTTP endpoints                          | `backend/StigviddAPI/Controllers/MediaController.cs`    |

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

## Client: `resizeImage`

Before upload, `resizeImage(uri)` runs an `expo-image-manipulator` pipeline: resize to
**max width 1080px** (height scales to preserve aspect ratio) and re-encode to **JPEG
at 0.6 compression**, writing a new file and returning its uri. This is purely a
bandwidth optimization — the server does the authoritative processing.

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
