# SpatiaLite in the integration tests is set up differently on Windows and on Linux

The integration suite runs SQLite in-memory with NetTopologySuite, and the geometry
support comes from **mod_spatialite**, which is a native library. How it is bound differs
by platform, and
[`IntegrationTests.csproj`](../../backend/Tests/IntegrationTests/IntegrationTests.csproj)
already encodes the split:

| | packages | provider |
| --- | --- | --- |
| Windows (`$(OS) == 'Windows_NT'`) | `Microsoft.EntityFrameworkCore.Sqlite`, `SQLitePCLRaw.bundle_e_sqlite3` | the **bundled** `e_sqlite3` |
| Linux (`$(OS) == 'UNIX'`) | `Microsoft.EntityFrameworkCore.Sqlite.Core`, `SQLitePCLRaw.provider.sqlite3` | the **system** `libsqlite3` |

On Linux, [`SqliteProvider.cs`](../../backend/Tests/IntegrationTests/SqliteProvider.cs)
calls `SQLitePCL.raw.SetProvider(new SQLite3Provider_sqlite3())` from a
`[ModuleInitializer]` — before any `SqliteConnection` can pick a provider first — and
`WebApplicationFactory` repeats it. Both are behind `#if !WINDOWS`, and the csproj
comment says why the bundle is Windows-only: on Linux `e_sqlite3` would **shadow the
libsqlite3 that mod_spatialite is linked against**, and the extension then fails to load.

## So a Linux box needs the distro's spatialite module installed

Measured, on the boxes this repo is developed on:

| | package | gives |
| --- | --- | --- |
| Debian 13 | `libsqlite3-mod-spatialite` (`libspatialite-dev` too, per ci.yml) | `/usr/lib/x86_64-linux-gnu/mod_spatialite.so` |
| Gentoo | `dev-db/spatialite` (5.1.0-r3) | `/usr/lib64/mod_spatialite.so` |
| Windows | nothing — the NuGet bundle carries it | |

Without it, the geometry-bearing tests fail on extension load rather than on anything you
changed. `.github/workflows/ci.yml` installs the Debian package explicitly for this
reason.

Related: [[dotnet-test-connection-string]], [[srid-4326]].
