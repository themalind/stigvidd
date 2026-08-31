# Loading mod_spatialite puts the system libjpeg 8 under Magick.NET, and only a full round-trip preload pins it

On Linux the integration suite failed in the JPEG tests with one of two faces, from the
same commit:

| | symptom |
| --- | --- |
| run 1 | exit 134 (SIGABRT), `double free or corruption (fasttop)`, **0** tests reported failed |
| run 2 | 8 failed, `Wrong JPEG library version: library is 80, caller expects 62` |

Both are one cause. `sqlite3_load_extension` dlopens `mod_spatialite` with **RTLD_GLOBAL**,
which puts its whole dependency chain (libgeotiff -> libtiff -> **libjpeg.so.8**) into the
global symbol namespace. Magick.NET's native library links its libjpeg **statically but
exports the symbols**, so they are interposable: once libjpeg 8 is global, Magick's own
lazily-bound internal calls land there while its code expects the 6.2 ABI.

Measured 2026-08-31 by parsing the ELF of
`~/.nuget/packages/magick.net-q8-anycpu/14.16.0/runtimes/linux-x64/native/Magick.Native-Q8-x64.dll.so`:

```
DT_NEEDED: libresolv, libpthread, libm, libc, ld-linux   <- no libjpeg at all
jpeg_CreateCompress present in the dynamic symbol table  <- exported, so interposable
```

## It is not a race, and the crash/assertion split is a red herring

Reproduced deterministically in a clean container (`mcr.microsoft.com/dotnet/sdk:10.0`,
which **is** Ubuntu 24.04 — the same distro as CI's `ubuntu-latest`), with
`libsqlite3-mod-spatialite libspatialite-dev` installed and
`ConnectionStrings__StigVidd=DataSource=:memory:`:

| | failed | libjpeg errors |
| --- | --- | --- |
| no preload, 3 runs | 9, 8, 8 | 16 |
| encode-only preload, 2 runs | 5, 5 | 5 |
| round-trip preload, 5 runs | **0** | **0** |

The run-to-run wobble is only which test reaches the bad binding first, not flakiness.

## Binding is lazy and per-symbol, so a preload has to walk every path

[`MagickPreload.cs`](../../backend/Tests/IntegrationTests/MagickPreload.cs) is a Linux-only
`[ModuleInitializer]` that exercises Magick's JPEG code at assembly load, before any
`SqliteConnection` opens, so the PLT entries resolve to Magick's own copy and stay resolved.

The trap is that a preload which only **encodes a plain JPEG** looks like it works and is
not enough. It took the suite from 8 failures to 5 and swapped the error message, which
reads like a different bug:

```
ImageMagick.MagickCorruptImageErrorException :
  JPEG parameter struct mismatch: library thinks size is 101, caller expects 0
```

Only the symbols actually *called* before `mod_spatialite` loads get pinned. A plain encode
never calls:

- `jpeg_write_marker` — reached only when writing an **EXIF APP1** marker, which is what
  `TestImages.JpegWithGps` does;
- the **decompress** family — reached only on decode, which is what
  [`ImageProcessingService.Process`](../../backend/Core/Services/ImageProcessingService.cs)
  does server-side. That is why `AddTrail_WithNoTrailImages_ShouldCreateTrail`, a test with
  no images in the request at all, failed with a 500.

So the preload round-trips: encode -> EXIF marker -> decode -> re-encode.

## Only the test suite is affected

Production runs on PostGIS via Npgsql and never loads `mod_spatialite`, so the collision
cannot happen there. Windows is unaffected too — the csproj defines `WINDOWS` and the whole
file is behind `#if !WINDOWS`.

Related: [[spatialite-per-os]], [[dotnet-test-connection-string]].
