# mod_spatialite frees libxml2's global state on every connection close, so parallel SQLite closes abort the test host

On Linux the integration suite can still die with

```
Error output: double free or corruption (fasttop)
Exit code: 134
```

and **Zero tests ran**, a few seconds in, with the pin from
[[mod-spatialite-unload-race]] in place. GitHub Actions hit it on 2026-09-26 (`6b79db9`, a
commit that touched no backend file; the same backend code was green the day before).

## The mechanism

A native backtrace of the aborting thread (gdb, Ubuntu 24.04, `libspatialite 5.1.0`,
`libxml2 2.9.14`):

```
sqlite3_close -> sqlite3LeaveMutexAndCloseZombie
  -> mod_spatialite.so   (per-connection cleanup: free(cache->...); call xmlCleanupParser@plt)
  -> libxml2.so.2 -> free -> malloc_printerr("double free or corruption (fasttop)") -> abort
```

The call site in mod_spatialite disassembles to `call free@plt; call xmlCleanupParser@plt`.
`xmlCleanupParser()` frees libxml2's **process-global** state, and libxml2's docs say to call
it once, when the process is done with the library. mod_spatialite runs it every time a connection that loaded it closes. xunit runs
test classes in parallel, and each class's `SeedDatabase()` -> `EnsureDeleted()` closes and
reopens its in-memory connection, so two threads free the same globals.

This is why the earlier diagnosis looked right and the pin only lowered the rate: the
`dotnet-dump` in [[mod-spatialite-unload-race]] caught a close racing an open, which is the
same window, and pinning the library removed one way to hit it but not this one.

## The fix

[`SerializedSqliteConnection.cs`](../../backend/Tests/IntegrationTests/SerializedSqliteConnection.cs)
subclasses `SqliteConnection` and takes one process-wide lock in `Open()` and `Close()`.
EF's `EnsureDeleted` and `Dispose` both go through those overrides. The factory in
[`WebApplicationFactory.cs`](../../backend/Tests/IntegrationTests/WebApplicationFactory.cs)
keeps every connection it creates and disposes them all, because `WithWebHostBuilder` reruns
`ConfigureWebHost` on the same instance; a connection left to the finalizer would close
outside the lock.

## Measured

`mcr.microsoft.com/dotnet/sdk:10.0` with `libsqlite3-mod-spatialite libspatialite-dev`,
`--cpus 4`, CI's `dotnet test --no-build` over the solution:

| | runs | aborted |
| --- | --- | --- |
| before (pin only) | 5 | 2 |
| with the lock | 20 | 0 |

All 20 runs with the lock ran the full 2051 tests. With `DOTNET_DbgEnableMiniDump` set, an
abort shows up as a hang (next section), so both "before" aborts were hangs.

## A crash dump turns this abort into a hang

With `DOTNET_DbgEnableMiniDump=1` the crash never exits: the runtime forks to launch
`createdump`, and in the child libproj's `atfork` handler closes its own SQLite database,
reaching `sqlite3_free`'s mutex, which the aborting parent held at fork time. The child
waits forever on a futex, the parent waits for the child, and `dotnet test` sits at 0% CPU.
Take native stacks with `gdb -p` (the container needs `--cap-add SYS_PTRACE`) instead of a
minidump.

Windows is not affected (bundled SpatiaLite, see [[spatialite-per-os]]), and production uses
PostGIS through Npgsql.
