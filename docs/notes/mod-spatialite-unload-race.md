# Closing the last SQLite connection unloads mod_spatialite, and a parallel test class loading it again aborts the process

On Linux the integration suite can die with

```
Error output: double free or corruption (fasttop)
Exit code: 134
```

and report **0 failed tests**, because the whole test host is killed a few seconds in. It
is intermittent. GitHub Actions hit it on `da330cc`, the first commit after
2026-08-31 whose `backend` job ran at all (every run between had an invalid `ci.yml` and
started no jobs).

## The mechanism

Every test class calls `StigViddWebApplicationFactory.SeedDatabase()`, which calls
`EnsureDeleted()`. For an in-memory database EF's `SqliteDatabaseCreator.Delete()` resets it
by **closing and reopening the connection**. Each open loads `mod_spatialite`
(`UseNetTopologySuite`), and each close runs `sqlite3_close_v2`, which `dlclose`s every
extension that connection loaded. xunit runs test classes in parallel, each with its own
factory and connection, so the library's reference count goes up and down across threads.
When one close drops it to zero, the loader unloads mod_spatialite and its dependency chain,
racing another thread that is dlopening it again.

A full dump (`DOTNET_DbgEnableMiniDump=1 DOTNET_DbgMiniDumpType=4`) read with
`dotnet-dump analyze` -> `clrstack -all` showed the two threads at the abort:

```
TrailImportReviewIntegrationTests..ctor -> SeedDatabase -> EnsureDeleted
  -> SqliteDatabaseCreator.Delete (line 142) -> SqliteConnection.Close -> sqlite3_close_v2
AdminControllerIntegrationTests..ctor   -> SeedDatabase -> EnsureDeleted
  -> SqliteDatabaseCreator.Delete (line 144) -> SqliteConnection.Open -> sqlite3_load_extension
```

## The fix

[`SqliteProvider.cs`](../../backend/Tests/IntegrationTests/SqliteProvider.cs)'s Linux-only
`[ModuleInitializer]` calls `NativeLibrary.TryLoad("mod_spatialite.so", out _)` and never
frees the handle. That holds one reference for the life of the process, so no `dlclose`
can reach zero. `NativeLibrary` dlopens without RTLD_GLOBAL, so it does not bring back the
libjpeg problem in [[magick-jpeg-collides-with-mod-spatialite]]. `LD_DEBUG=files` confirms
the first load is `dynamically loaded by .../libcoreclr.so`, before SQLite's.

`ldconfig -p` does **not** list `mod_spatialite` (it is not a `lib*` soname), which makes the
bare name look unresolvable. It resolves anyway: the file is in
`/usr/lib/x86_64-linux-gnu`, which is on the loader's default search path.

## Measured

`mcr.microsoft.com/dotnet/sdk:10.0` (Ubuntu 24.04, as CI), `libsqlite3-mod-spatialite
libspatialite-dev`, container limited to 4 CPUs, CI's exact
`dotnet test --no-build` over the whole solution:

| | runs | aborted |
| --- | --- | --- |
| `da330cc`, no pin | 6 | 3 |
| with the pin | 10 | 0 |

Running **only** the integration project did not abort in 3 runs. The unit-test process
running alongside changes the timing, so reproduce with the solution-level command.

## Windows is not affected

Windows binds the bundled `e_sqlite3` and SpatiaLite from NuGet, and the file is behind
`#if !WINDOWS` (see [[spatialite-per-os]]). Production uses PostGIS through Npgsql and never
loads the extension.
